import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Agency } from '../agencies/agency.entity';
import { AgenciesService } from '../agencies/agencies.service';
import { Sale } from '../sales/sale.entity';
import { UsersService } from '../users/users.service';
import { AdjustInfluencerCreditDto } from './dto/adjust-credit.dto';
import { CreateInfluencerDto } from './dto/create-influencer.dto';
import { UpdateInfluencerDto } from './dto/update-influencer.dto';
import {
  InfluencerCreditLedgerEntry,
  InfluencerCreditLedgerReason,
} from './influencer-credit-ledger.entity';
import { Influencer } from './influencer.entity';

export type InfluencerWithStats = Influencer & {
  items_sold: number;
  revenue: number;
  credit: number;
  agency_name: string | null;
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

@Injectable()
export class InfluencersService {
  constructor(
    @InjectRepository(Influencer)
    private readonly influencersRepo: Repository<Influencer>,
    @InjectRepository(Agency)
    private readonly agenciesRepo: Repository<Agency>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    @InjectRepository(InfluencerCreditLedgerEntry)
    private readonly ledgerRepo: Repository<InfluencerCreditLedgerEntry>,
    private readonly agenciesService: AgenciesService,
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
    const influencers = await this.influencersRepo.find({
      relations: { agency: true },
      order: { name: 'ASC' },
    });
    return this.attachStats(influencers);
  }

  async getById(id: string): Promise<InfluencerWithStats | null> {
    const influencer = await this.influencersRepo.findOne({
      where: { id },
      relations: { agency: true },
    });
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

    const entries = influencer.agency_id
      ? await this.ledgerRepo.find({
          where: { agency_id: influencer.agency_id },
          relations: {
            performedByBackofficeUser: true,
            relatedSale: { influencer: true },
          },
          order: { occurred_at: 'DESC' },
        })
      : await this.ledgerRepo.find({
          where: { influencer_id: influencerId, agency_id: IsNull() },
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
      influencer_id: influencer.id,
      agency_id: influencer.agency_id ?? null,
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
    const agencyId = dto.agencyId?.trim() || null;
    const newAgencyName = dto.newAgencyName?.trim() || null;

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

    if (agencyId && newAgencyName) {
      throw new BadRequestException(
        'Specify either an existing agency or a new agency name, not both',
      );
    }

    let resolvedAgencyId: string | null = null;

    if (agencyId) {
      const agency = await this.agenciesRepo.findOne({ where: { id: agencyId } });
      if (!agency) {
        throw new NotFoundException('Agency not found');
      }
      resolvedAgencyId = agency.id;
    } else if (newAgencyName) {
      const created = await this.agenciesService.create({ name: newAgencyName });
      resolvedAgencyId = created.id;
    }

    const saved = await this.influencersRepo.save(
      this.influencersRepo.create({
        name,
        address_street: addressStreet,
        address_city: addressCity,
        address_code: addressCode,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        agency_id: resolvedAgencyId,
        parent_influencer_id: null,
        group_id: null,
      }),
    );

    return (await this.getById(saved.id))!;
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

    if (dto.agencyId !== undefined) {
      const nextAgencyId = dto.agencyId?.trim() || null;
      if (nextAgencyId) {
        const agency = await this.agenciesRepo.findOne({
          where: { id: nextAgencyId },
        });
        if (!agency) {
          throw new NotFoundException('Agency not found');
        }
        influencer.agency_id = agency.id;
      } else {
        influencer.agency_id = null;
      }
    }

    await this.influencersRepo.save(influencer);
    return (await this.getById(id))!;
  }

  async deleteInfluencer(id: string): Promise<void> {
    const influencer = await this.influencersRepo.findOne({ where: { id } });
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
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
          `CASE
            WHEN influencer.agency_id IS NOT NULL THEN (
              SELECT COALESCE(SUM(l.change_amount::numeric), 0)
              FROM influencer_credit_ledger l
              WHERE l.agency_id = influencer.agency_id
            )
            ELSE (
              SELECT COALESCE(SUM(l.change_amount::numeric), 0)
              FROM influencer_credit_ledger l
              WHERE l.influencer_id = influencer.id AND l.agency_id IS NULL
            )
          END`,
          direction,
        );
        break;
      case 'parent':
      case 'agency':
        qb.orderBy(
          `(SELECT LOWER(a.name) FROM agencies a WHERE a.id = influencer.agency_id)`,
          direction,
          'NULLS LAST',
        );
        break;
      case 'name':
      default:
        qb.orderBy('LOWER(influencer.name)', direction);
    }
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

    const agencyIds = [
      ...new Set(
        influencers
          .map((i) => i.agency_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const standaloneIds = influencers
      .filter((i) => !i.agency_id)
      .map((i) => i.id);

    const creditByAgency = new Map<string, number>();
    if (agencyIds.length > 0) {
      const agencyCreditRows = await this.ledgerRepo
        .createQueryBuilder('ledger')
        .select('ledger.agency_id', 'agency_id')
        .addSelect('COALESCE(SUM(ledger.change_amount), 0)', 'credit')
        .where('ledger.agency_id IN (:...agencyIds)', { agencyIds })
        .groupBy('ledger.agency_id')
        .getRawMany<{ agency_id: string; credit: string }>();
      for (const row of agencyCreditRows) {
        creditByAgency.set(row.agency_id, Number(row.credit));
      }
    }

    const creditByInfluencer = new Map<string, number>();
    if (standaloneIds.length > 0) {
      const personalCreditRows = await this.ledgerRepo
        .createQueryBuilder('ledger')
        .select('ledger.influencer_id', 'influencer_id')
        .addSelect('COALESCE(SUM(ledger.change_amount), 0)', 'credit')
        .where('ledger.influencer_id IN (:...standaloneIds)', { standaloneIds })
        .andWhere('ledger.agency_id IS NULL')
        .groupBy('ledger.influencer_id')
        .getRawMany<{ influencer_id: string; credit: string }>();
      for (const row of personalCreditRows) {
        creditByInfluencer.set(row.influencer_id, Number(row.credit));
      }
    }

    // Load agency names if relation missing
    const missingAgencyIds = influencers
      .filter((i) => i.agency_id && !i.agency)
      .map((i) => i.agency_id!);
    const agenciesById = new Map<string, Agency>();
    if (missingAgencyIds.length > 0) {
      const agencies = await this.agenciesRepo.find({
        where: { id: In([...new Set(missingAgencyIds)]) },
      });
      for (const agency of agencies) {
        agenciesById.set(agency.id, agency);
      }
    }

    const salesByInfluencer = new Map(
      salesRows.map((row) => [
        row.influencer_id,
        {
          items_sold: Number(row.items_sold),
          revenue: Number(row.revenue),
        },
      ]),
    );

    return influencers.map((influencer) => {
      const sales = salesByInfluencer.get(influencer.id) ?? {
        items_sold: 0,
        revenue: 0,
      };
      const agencyName =
        influencer.agency?.name ??
        (influencer.agency_id
          ? (agenciesById.get(influencer.agency_id)?.name ?? null)
          : null);
      const credit = influencer.agency_id
        ? (creditByAgency.get(influencer.agency_id) ?? 0)
        : (creditByInfluencer.get(influencer.id) ?? 0);

      return {
        ...influencer,
        items_sold: sales.items_sold,
        revenue: sales.revenue,
        credit,
        agency_name: agencyName,
      };
    });
  }

  private toLedgerListItem(
    entry: InfluencerCreditLedgerEntry,
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

  private ledgerUserName(entry: InfluencerCreditLedgerEntry): string {
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
