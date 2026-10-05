import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../sales/sale.entity';
import { UsersService } from '../users/users.service';
import { AdjustInfluencerCreditDto } from './dto/adjust-credit.dto';
import { CreateInfluencerDto } from './dto/create-influencer.dto';
import { UpdateInfluencerDto } from './dto/update-influencer.dto';
import {
  InfluencerCreditLedgerReason,
  InfluencerGroupCreditLedgerEntry,
} from './influencer-group-credit-ledger.entity';
import { InfluencerGroup } from './influencer-group.entity';
import { Influencer } from './influencer.entity';

export type InfluencerWithStats = Influencer & {
  items_sold: number;
  revenue: number;
  credit: number;
};

export type InfluencerListResult = {
  items: InfluencerWithStats[];
  total: number;
  page: number;
  pageSize: number;
};

export type InfluencerCreditLedgerListItem = {
  id: string;
  date: string;
  creditChange: number;
  userName: string;
  reason: InfluencerCreditLedgerReason;
  note: string | null;
};

type InfluencerSalesRow = {
  influencer_id: string;
  items_sold: string;
  revenue: string;
};

type GroupCreditRow = {
  group_id: string;
  credit: string;
};

@Injectable()
export class InfluencersService {
  constructor(
    @InjectRepository(Influencer)
    private readonly influencersRepo: Repository<Influencer>,
    @InjectRepository(InfluencerGroup)
    private readonly groupsRepo: Repository<InfluencerGroup>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    @InjectRepository(InfluencerGroupCreditLedgerEntry)
    private readonly ledgerRepo: Repository<InfluencerGroupCreditLedgerEntry>,
    private readonly usersService: UsersService,
  ) {}

  async listPaginated(
    search?: string,
    page = 1,
    pageSize = 10,
    sortBy?: string,
    sortDir?: string,
  ): Promise<InfluencerListResult> {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 10));

    const qb = this.influencersRepo.createQueryBuilder('influencer');

    this.applyListableFilter(qb);
    this.applyInfluencerSort(qb, sortBy, sortDir);

    const query = search?.trim().toLowerCase();
    if (query) {
      qb.andWhere('LOWER(influencer.name) LIKE :query', {
        query: `%${query}%`,
      });
    }

    const [influencers, total] = await qb
      .skip((safePage - 1) * safePageSize)
      .take(safePageSize)
      .getManyAndCount();

    const items = await this.attachStats(influencers);

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async listAll(): Promise<InfluencerWithStats[]> {
    const influencers = await this.influencersRepo
      .createQueryBuilder('influencer')
      .orderBy('LOWER(influencer.name)', 'ASC')
      .getMany();
    return this.attachStats(influencers);
  }

  async getById(id: string): Promise<InfluencerWithStats | null> {
    const influencer = await this.influencersRepo.findOne({ where: { id } });
    if (!influencer) {
      return null;
    }
    const [withStats] = await this.attachStats([influencer]);
    return withStats;
  }

  async getCreditLedger(
    influencerId: string,
  ): Promise<InfluencerCreditLedgerListItem[]> {
    const influencer = await this.influencersRepo.findOne({
      where: { id: influencerId },
    });
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    const entries = await this.ledgerRepo.find({
      where: { group_id: influencer.group_id },
      relations: {
        performedByBackofficeUser: true,
        relatedSale: { influencer: true },
      },
      order: { occurred_at: 'DESC' },
    });

    return entries.map((entry) => this.toLedgerListItem(entry));
  }

  async adjustCredit(
    influencerId: string,
    firebaseUid: string,
    dto: AdjustInfluencerCreditDto,
  ): Promise<InfluencerCreditLedgerListItem> {
    const influencer = await this.influencersRepo.findOne({
      where: { id: influencerId },
    });
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    const backofficeUser =
      await this.usersService.findByFirebaseUid(firebaseUid);
    if (!backofficeUser) {
      throw new NotFoundException('User not found');
    }

    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    if (dto.direction !== 'increase' && dto.direction !== 'decrease') {
      throw new BadRequestException('Invalid adjustment direction');
    }

    const changeAmount =
      dto.direction === 'decrease' ? -Math.abs(amount) : Math.abs(amount);

    const entry = this.ledgerRepo.create({
      group_id: influencer.group_id,
      occurred_at: new Date(),
      change_amount: String(changeAmount),
      reason: InfluencerCreditLedgerReason.ADJUSTMENT,
      performed_by_backoffice_user_id: backofficeUser.id,
      performed_by_name: this.backofficeUserName(backofficeUser),
      note: dto.note?.trim() || null,
    });

    const saved = await this.ledgerRepo.save(entry);
    const withUser = await this.ledgerRepo.findOne({
      where: { id: saved.id },
      relations: { performedByBackofficeUser: true },
    });

    if (!withUser) {
      throw new NotFoundException('Ledger entry not found');
    }

    return this.toLedgerListItem(withUser);
  }

  async create(dto: CreateInfluencerDto): Promise<InfluencerWithStats> {
    const name = dto.name?.trim();
    const addressStreet = dto.addressStreet?.trim();
    const addressCity = dto.addressCity?.trim();
    const addressCode = dto.addressCode?.trim();
    const contactEmail = dto.contactEmail?.trim();
    const contactPhone = dto.contactPhone?.trim();
    const parentInfluencerId = dto.parentInfluencerId?.trim() || null;
    const newParentName = dto.newParentName?.trim() || null;

    if (
      !name ||
      !addressStreet ||
      !addressCity ||
      !addressCode ||
      !contactEmail ||
      !contactPhone
    ) {
      throw new BadRequestException(
        'Name, address, contact email, and contact phone are required',
      );
    }

    if (parentInfluencerId && newParentName) {
      throw new BadRequestException(
        'Specify either an existing parent influencer or a new parent name, not both',
      );
    }

    const addressFields = {
      address_street: addressStreet,
      address_city: addressCity,
      address_code: addressCode,
    };

    let saved: Influencer;

    if (parentInfluencerId) {
      const parent = await this.influencersRepo.findOne({
        where: { id: parentInfluencerId },
      });
      if (!parent) {
        throw new NotFoundException('Parent influencer not found');
      }

      const influencer = this.influencersRepo.create({
        name,
        ...addressFields,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        group_id: parent.group_id,
        parent_influencer_id: parent.id,
      });
      saved = await this.influencersRepo.save(influencer);
    } else if (newParentName) {
      const group = this.groupsRepo.create({ name: newParentName });
      const savedGroup = await this.groupsRepo.save(group);

      const parent = this.influencersRepo.create({
        name: newParentName,
        address_street: '—',
        address_city: '—',
        address_code: '—',
        contact_email: contactEmail,
        contact_phone: contactPhone,
        group_id: savedGroup.id,
        parent_influencer_id: null,
      });
      const savedParent = await this.influencersRepo.save(parent);

      const influencer = this.influencersRepo.create({
        name,
        ...addressFields,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        group_id: savedGroup.id,
        parent_influencer_id: savedParent.id,
      });
      saved = await this.influencersRepo.save(influencer);
    } else {
      const group = this.groupsRepo.create({ name });
      const savedGroup = await this.groupsRepo.save(group);

      const influencer = this.influencersRepo.create({
        name,
        ...addressFields,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        group_id: savedGroup.id,
        parent_influencer_id: null,
      });
      saved = await this.influencersRepo.save(influencer);
    }

    const [withStats] = await this.attachStats([saved]);
    return withStats;
  }

  async updateContact(
    id: string,
    dto: UpdateInfluencerDto,
  ): Promise<InfluencerWithStats> {
    const influencer = await this.influencersRepo.findOne({ where: { id } });
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    if (dto.addressStreet !== undefined) {
      const street = dto.addressStreet.trim();
      if (!street) {
        throw new BadRequestException('Street address is required');
      }
      influencer.address_street = street;
    }

    if (dto.addressCity !== undefined) {
      const city = dto.addressCity.trim();
      if (!city) {
        throw new BadRequestException('City is required');
      }
      influencer.address_city = city;
    }

    if (dto.addressCode !== undefined) {
      const code = dto.addressCode.trim();
      if (!code) {
        throw new BadRequestException('Postal code is required');
      }
      influencer.address_code = code;
    }

    if (dto.contactEmail !== undefined) {
      const email = dto.contactEmail.trim();
      if (!email) {
        throw new BadRequestException('Contact email is required');
      }
      influencer.contact_email = email;
    }

    if (dto.contactPhone !== undefined) {
      const phone = dto.contactPhone.trim();
      if (!phone) {
        throw new BadRequestException('Contact phone is required');
      }
      influencer.contact_phone = phone;
    }

    const saved = await this.influencersRepo.save(influencer);
    const [withStats] = await this.attachStats([saved]);
    return withStats;
  }

  async deleteInfluencer(id: string): Promise<void> {
    const influencer = await this.influencersRepo.findOne({ where: { id } });
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    const childCount = await this.influencersRepo.count({
      where: { parent_influencer_id: id },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        "Remove this influencer's branches before deleting it",
      );
    }

    const salesCount = await this.salesRepo.count({
      where: { influencer_id: id },
    });
    if (salesCount > 0) {
      throw new BadRequestException(
        'This influencer has recorded sales and cannot be deleted',
      );
    }

    await this.influencersRepo.softDelete(id);
  }

  private applyInfluencerSort(
    qb: ReturnType<Repository<Influencer>['createQueryBuilder']>,
    sortBy?: string,
    sortDir?: string,
  ): void {
    const direction = sortDir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    switch (sortBy) {
      case 'itemsSold':
        qb.orderBy(
          `(SELECT COALESCE(SUM(s.quantity), 0) FROM sales s WHERE s.influencer_id = influencer.id)`,
          direction,
        );
        break;
      case 'revenue':
        qb.orderBy(
          `(SELECT COALESCE(SUM(s.quantity * s.unit_price_snapshot::numeric), 0) FROM sales s WHERE s.influencer_id = influencer.id)`,
          direction,
        );
        break;
      case 'credit':
        qb.orderBy(
          `(SELECT COALESCE(SUM(l.change_amount::numeric), 0) FROM influencer_group_credit_ledger l WHERE l.group_id = influencer.group_id)`,
          direction,
        );
        break;
      case 'parent':
        qb.orderBy(
          `(SELECT LOWER(p.name) FROM influencers p WHERE p.id = influencer.parent_influencer_id)`,
          direction,
          'NULLS LAST',
        );
        break;
      case 'name':
      default:
        qb.orderBy('LOWER(influencer.name)', direction);
    }
  }

  private applyListableFilter(
    qb: ReturnType<Repository<Influencer>['createQueryBuilder']>,
  ): void {
    qb.andWhere(
      `NOT EXISTS (
        SELECT 1 FROM influencers child
        WHERE child.parent_influencer_id = influencer.id
      )`,
    );
  }

  private async attachStats(
    influencers: Influencer[],
  ): Promise<InfluencerWithStats[]> {
    if (influencers.length === 0) {
      return [];
    }

    const salesRows = await this.salesRepo
      .createQueryBuilder('sale')
      .select('sale.influencer_id', 'influencer_id')
      .addSelect('COALESCE(SUM(sale.quantity), 0)', 'items_sold')
      .addSelect(
        'COALESCE(SUM(sale.quantity * sale.unit_price_snapshot), 0)',
        'revenue',
      )
      .where('sale.influencer_id IS NOT NULL')
      .groupBy('sale.influencer_id')
      .getRawMany<InfluencerSalesRow>();

    const creditRows = await this.ledgerRepo
      .createQueryBuilder('ledger')
      .select('ledger.group_id', 'group_id')
      .addSelect('COALESCE(SUM(ledger.change_amount), 0)', 'credit')
      .groupBy('ledger.group_id')
      .getRawMany<GroupCreditRow>();

    const salesByInfluencer = new Map(
      salesRows.map((row) => [
        row.influencer_id,
        {
          items_sold: Number(row.items_sold),
          revenue: Number(row.revenue),
        },
      ]),
    );

    const creditByGroup = new Map(
      creditRows.map((row) => [row.group_id, Number(row.credit)]),
    );

    return influencers.map((influencer) => {
      const sales = salesByInfluencer.get(influencer.id) ?? {
        items_sold: 0,
        revenue: 0,
      };
      return {
        ...influencer,
        items_sold: sales.items_sold,
        revenue: sales.revenue,
        credit: creditByGroup.get(influencer.group_id) ?? 0,
      };
    });
  }

  private toLedgerListItem(
    entry: InfluencerGroupCreditLedgerEntry,
  ): InfluencerCreditLedgerListItem {
    return {
      id: entry.id,
      date: entry.occurred_at.toISOString(),
      creditChange: Number(entry.change_amount),
      userName: this.ledgerUserName(entry),
      reason: entry.reason,
      note: entry.note ?? null,
    };
  }

  private ledgerUserName(entry: InfluencerGroupCreditLedgerEntry): string {
    if (entry.performed_by_name) {
      return entry.performed_by_name;
    }
    const user = entry.performedByBackofficeUser;
    if (user) {
      return this.backofficeUserName(user);
    }
    return 'System';
  }

  private backofficeUserName(user: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  }): string {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : user.email;
  }
}
