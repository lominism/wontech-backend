import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../sales/sale.entity';
import { Clinic } from './clinic.entity';
import { ClinicGroup } from './clinic-group.entity';
import {
  ClinicGroupCreditLedgerEntry,
  CreditLedgerReason,
} from './clinic-group-credit-ledger.entity';
import { UsersService } from '../users/users.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { AdjustCreditDto } from './dto/adjust-credit.dto';

export type ClinicWithStats = Clinic & {
  items_sold: number;
  revenue: number;
  credit: number;
};

export type ClinicListResult = {
  items: ClinicWithStats[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreditLedgerListItem = {
  id: string;
  date: string;
  creditChange: number;
  userName: string;
  reason: CreditLedgerReason;
  note: string | null;
};

type ClinicSalesRow = {
  clinic_id: string;
  items_sold: string;
  revenue: string;
};

type GroupCreditRow = {
  group_id: string;
  credit: string;
};

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicsRepo: Repository<Clinic>,
    @InjectRepository(ClinicGroup)
    private readonly groupsRepo: Repository<ClinicGroup>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    @InjectRepository(ClinicGroupCreditLedgerEntry)
    private readonly ledgerRepo: Repository<ClinicGroupCreditLedgerEntry>,
    private readonly usersService: UsersService,
  ) {}

  async listPaginated(
    search?: string,
    page = 1,
    pageSize = 10,
    sortBy?: string,
    sortDir?: string,
  ): Promise<ClinicListResult> {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 10));

    const qb = this.clinicsRepo.createQueryBuilder('clinic');

    this.applyListableFilter(qb);
    this.applyClinicSort(qb, sortBy, sortDir);

    const query = search?.trim().toLowerCase();
    if (query) {
      qb.andWhere('LOWER(clinic.name) LIKE :query', { query: `%${query}%` });
    }

    const [clinics, total] = await qb
      .skip((safePage - 1) * safePageSize)
      .take(safePageSize)
      .getManyAndCount();

    const items = await this.attachStats(clinics);

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async listAll(): Promise<ClinicWithStats[]> {
    const clinics = await this.clinicsRepo
      .createQueryBuilder('clinic')
      .orderBy('LOWER(clinic.name)', 'ASC')
      .getMany();
    return this.attachStats(clinics);
  }

  async list(): Promise<ClinicWithStats[]> {
    return this.listAll();
  }

  async getById(id: string): Promise<ClinicWithStats | null> {
    const clinic = await this.clinicsRepo.findOne({ where: { id } });
    if (!clinic) {
      return null;
    }
    const [withStats] = await this.attachStats([clinic]);
    return withStats;
  }

  async getCreditLedger(clinicId: string): Promise<CreditLedgerListItem[]> {
    const clinic = await this.clinicsRepo.findOne({ where: { id: clinicId } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    const entries = await this.ledgerRepo.find({
      where: { group_id: clinic.group_id },
      relations: {
        performedByBackofficeUser: true,
        relatedSale: { clinic: true },
      },
      order: { occurred_at: 'DESC' },
    });

    return entries.map((entry) => this.toLedgerListItem(entry));
  }

  async adjustCredit(
    clinicId: string,
    firebaseUid: string,
    dto: AdjustCreditDto,
  ): Promise<CreditLedgerListItem> {
    const clinic = await this.clinicsRepo.findOne({ where: { id: clinicId } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    const backofficeUser = await this.usersService.findByFirebaseUid(firebaseUid);
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
      group_id: clinic.group_id,
      occurred_at: new Date(),
      change_amount: String(changeAmount),
      reason: CreditLedgerReason.ADJUSTMENT,
      performed_by_backoffice_user_id: backofficeUser.id,
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

  async create(dto: CreateClinicDto): Promise<ClinicWithStats> {
    const name = dto.name?.trim();
    const addressStreet = dto.addressStreet?.trim();
    const addressCity = dto.addressCity?.trim();
    const addressCode = dto.addressCode?.trim();
    const contactEmail = dto.contactEmail?.trim();
    const parentClinicId = dto.parentClinicId?.trim() || null;
    const newParentName = dto.newParentName?.trim() || null;

    if (!name || !addressStreet || !addressCity || !addressCode || !contactEmail) {
      throw new BadRequestException(
        'Name, address, and contact email are required',
      );
    }

    if (parentClinicId && newParentName) {
      throw new BadRequestException(
        'Specify either an existing parent clinic or a new parent name, not both',
      );
    }

    const addressFields = {
      address_street: addressStreet,
      address_city: addressCity,
      address_code: addressCode,
    };

    let saved: Clinic;

    if (parentClinicId) {
      const parent = await this.clinicsRepo.findOne({
        where: { id: parentClinicId },
      });
      if (!parent) {
        throw new NotFoundException('Parent clinic not found');
      }

      const clinic = this.clinicsRepo.create({
        name,
        ...addressFields,
        contact_email: contactEmail,
        group_id: parent.group_id,
        parent_clinic_id: parent.id,
      });
      saved = await this.clinicsRepo.save(clinic);
    } else if (newParentName) {
      const group = this.groupsRepo.create({ name: newParentName });
      const savedGroup = await this.groupsRepo.save(group);

      const parent = this.clinicsRepo.create({
        name: newParentName,
        address_street: '—',
        address_city: '—',
        address_code: '—',
        contact_email: contactEmail,
        group_id: savedGroup.id,
        parent_clinic_id: null,
      });
      const savedParent = await this.clinicsRepo.save(parent);

      const clinic = this.clinicsRepo.create({
        name,
        ...addressFields,
        contact_email: contactEmail,
        group_id: savedGroup.id,
        parent_clinic_id: savedParent.id,
      });
      saved = await this.clinicsRepo.save(clinic);
    } else {
      const group = this.groupsRepo.create({ name });
      const savedGroup = await this.groupsRepo.save(group);

      const clinic = this.clinicsRepo.create({
        name,
        ...addressFields,
        contact_email: contactEmail,
        group_id: savedGroup.id,
        parent_clinic_id: null,
      });
      saved = await this.clinicsRepo.save(clinic);
    }

    const [withStats] = await this.attachStats([saved]);
    return withStats;
  }

  private applyClinicSort(
    qb: ReturnType<Repository<Clinic>['createQueryBuilder']>,
    sortBy?: string,
    sortDir?: string,
  ): void {
    const direction = sortDir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    switch (sortBy) {
      case 'itemsSold':
        qb.orderBy(
          `(SELECT COALESCE(SUM(s.quantity), 0) FROM sales s WHERE s.clinic_id = clinic.id)`,
          direction,
        );
        break;
      case 'revenue':
        qb.orderBy(
          `(SELECT COALESCE(SUM(s.quantity * s.unit_price_snapshot::numeric), 0) FROM sales s WHERE s.clinic_id = clinic.id)`,
          direction,
        );
        break;
      case 'credit':
        qb.orderBy(
          `(SELECT COALESCE(SUM(l.change_amount::numeric), 0) FROM clinic_group_credit_ledger l WHERE l.group_id = clinic.group_id)`,
          direction,
        );
        break;
      case 'parent':
        qb.orderBy(
          `(SELECT LOWER(p.name) FROM clinics p WHERE p.id = clinic.parent_clinic_id)`,
          direction,
          'NULLS LAST',
        );
        break;
      case 'name':
      default:
        qb.orderBy('LOWER(clinic.name)', direction);
    }
  }

  private applyListableFilter(
    qb: ReturnType<Repository<Clinic>['createQueryBuilder']>,
  ): void {
    qb.andWhere(
      `NOT EXISTS (
        SELECT 1 FROM clinics child
        WHERE child.parent_clinic_id = clinic.id
      )`,
    );
  }

  private async attachStats(clinics: Clinic[]): Promise<ClinicWithStats[]> {
    if (clinics.length === 0) {
      return [];
    }

    const salesRows = await this.salesRepo
      .createQueryBuilder('sale')
      .select('sale.clinic_id', 'clinic_id')
      .addSelect('COALESCE(SUM(sale.quantity), 0)', 'items_sold')
      .addSelect(
        'COALESCE(SUM(sale.quantity * sale.unit_price_snapshot), 0)',
        'revenue',
      )
      .groupBy('sale.clinic_id')
      .getRawMany<ClinicSalesRow>();

    const creditRows = await this.ledgerRepo
      .createQueryBuilder('ledger')
      .select('ledger.group_id', 'group_id')
      .addSelect('COALESCE(SUM(ledger.change_amount), 0)', 'credit')
      .groupBy('ledger.group_id')
      .getRawMany<GroupCreditRow>();

    const salesByClinic = new Map(
      salesRows.map((row) => [
        row.clinic_id,
        {
          items_sold: Number(row.items_sold),
          revenue: Number(row.revenue),
        },
      ]),
    );

    const creditByGroup = new Map(
      creditRows.map((row) => [row.group_id, Number(row.credit)]),
    );

    return clinics.map((clinic) => {
      const sales = salesByClinic.get(clinic.id) ?? {
        items_sold: 0,
        revenue: 0,
      };
      return {
        ...clinic,
        items_sold: sales.items_sold,
        revenue: sales.revenue,
        credit: creditByGroup.get(clinic.group_id) ?? 0,
      };
    });
  }

  private toLedgerListItem(
    entry: ClinicGroupCreditLedgerEntry,
  ): CreditLedgerListItem {
    return {
      id: entry.id,
      date: entry.occurred_at.toISOString(),
      creditChange: Number(entry.change_amount),
      userName: this.ledgerUserName(entry),
      reason: entry.reason,
      note: entry.note ?? null,
    };
  }

  private ledgerUserName(entry: ClinicGroupCreditLedgerEntry): string {
    const user = entry.performedByBackofficeUser;
    if (user) {
      const parts = [user.firstName, user.lastName].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(' ');
      }
      return user.email;
    }
    return 'System';
  }
}
