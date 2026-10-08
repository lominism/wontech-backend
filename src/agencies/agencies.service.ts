import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { Influencer } from '../influencers/influencer.entity';
import { InfluencerCreditLedgerEntry } from '../influencers/influencer-credit-ledger.entity';
import { Agency } from './agency.entity';
import { CreateAgencyDto } from './dto/create-agency.dto';

export type AgencyListItem = {
  id: string;
  name: string;
  memberCount: number;
  credit: number;
};

@Injectable()
export class AgenciesService implements OnModuleInit {
  private readonly logger = new Logger(AgenciesService.name);

  constructor(
    @InjectRepository(Agency)
    private readonly agenciesRepo: Repository<Agency>,
    @InjectRepository(Influencer)
    private readonly influencersRepo: Repository<Influencer>,
    @InjectRepository(InfluencerCreditLedgerEntry)
    private readonly ledgerRepo: Repository<InfluencerCreditLedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.migrateFromParentHierarchy();
    await this.migrateLegacyGroupLedger();
  }

  async list(): Promise<AgencyListItem[]> {
    const agencies = await this.agenciesRepo.find({
      order: { name: 'ASC' },
    });
    if (agencies.length === 0) return [];

    const memberRows = await this.influencersRepo
      .createQueryBuilder('influencer')
      .select('influencer.agency_id', 'agency_id')
      .addSelect('COUNT(*)', 'member_count')
      .where('influencer.agency_id IS NOT NULL')
      .groupBy('influencer.agency_id')
      .getRawMany<{ agency_id: string; member_count: string }>();

    const creditRows = await this.ledgerRepo
      .createQueryBuilder('ledger')
      .select('ledger.agency_id', 'agency_id')
      .addSelect('COALESCE(SUM(ledger.change_amount), 0)', 'credit')
      .where('ledger.agency_id IS NOT NULL')
      .groupBy('ledger.agency_id')
      .getRawMany<{ agency_id: string; credit: string }>();

    const membersByAgency = new Map(
      memberRows.map((row) => [row.agency_id, Number(row.member_count)]),
    );
    const creditByAgency = new Map(
      creditRows.map((row) => [row.agency_id, Number(row.credit)]),
    );

    return agencies.map((agency) => ({
      id: agency.id,
      name: agency.name,
      memberCount: membersByAgency.get(agency.id) ?? 0,
      credit: creditByAgency.get(agency.id) ?? 0,
    }));
  }

  async create(dto: CreateAgencyDto): Promise<AgencyListItem> {
    const name = dto.name?.trim() ?? '';
    if (!name) {
      throw new BadRequestException('Agency name is required');
    }

    const existing = await this.agenciesRepo.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException('Agency already exists');
    }

    const agency = await this.agenciesRepo.save(
      this.agenciesRepo.create({ name }),
    );

    return {
      id: agency.id,
      name: agency.name,
      memberCount: 0,
      credit: 0,
    };
  }

  async getById(id: string): Promise<Agency | null> {
    return this.agenciesRepo.findOne({ where: { id } });
  }

  async getCreditBalance(agencyId: string): Promise<number> {
    const row = await this.ledgerRepo
      .createQueryBuilder('ledger')
      .select('COALESCE(SUM(ledger.change_amount), 0)', 'credit')
      .where('ledger.agency_id = :agencyId', { agencyId })
      .getRawOne<{ credit: string }>();
    return Number(row?.credit ?? 0);
  }

  async delete(id: string): Promise<void> {
    const agency = await this.agenciesRepo.findOne({ where: { id } });
    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const credit = await this.getCreditBalance(id);
    if (Math.abs(credit) > 1e-9) {
      throw new BadRequestException(
        'Agency credit must be 0 before it can be deleted',
      );
    }

    // Credit can be 0 while historical ledger rows still reference the agency.
    // Clear those FKs (including soft-deleted influencers) before deleting.
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from(InfluencerCreditLedgerEntry)
        .where('agency_id = :id', { id })
        .execute();

      await manager
        .createQueryBuilder()
        .update(Influencer)
        .set({ agency_id: null })
        .where('agency_id = :id', { id })
        .execute();

      await manager
        .createQueryBuilder()
        .delete()
        .from(Agency)
        .where('id = :id', { id })
        .execute();
    });
  }

  private async migrateFromParentHierarchy(): Promise<void> {
    const parents = await this.influencersRepo
      .createQueryBuilder('parent')
      .where(
        `EXISTS (
          SELECT 1 FROM influencers child
          WHERE child.parent_influencer_id = parent.id
            AND child."deletedAt" IS NULL
        )`,
      )
      .andWhere('parent.agency_id IS NULL')
      .getMany();

    if (parents.length === 0) return;

    this.logger.log(
      `Migrating ${parents.length} parent influencer(s) to agencies`,
    );

    for (const parent of parents) {
      let agency = await this.agenciesRepo.findOne({
        where: { name: parent.name },
      });
      if (!agency) {
        agency = await this.agenciesRepo.save(
          this.agenciesRepo.create({ name: parent.name }),
        );
      }

      await this.influencersRepo
        .createQueryBuilder()
        .update(Influencer)
        .set({ agency_id: agency.id, parent_influencer_id: null })
        .where('parent_influencer_id = :parentId', { parentId: parent.id })
        .execute();

      await this.influencersRepo.softDelete(parent.id);
    }
  }

  private async migrateLegacyGroupLedger(): Promise<void> {
    const hasOldTable = await this.dataSource.query(`
      SELECT to_regclass('public.influencer_group_credit_ledger') AS name
    `);
    if (!hasOldTable?.[0]?.name) return;

    const newCount = await this.ledgerRepo.count();
    if (newCount > 0) return;

    const oldRows: Array<{
      id: string;
      group_id: string;
      occurred_at: Date;
      change_amount: string;
      reason: string;
      performed_by_backoffice_user_id: string | null;
      performed_by_name: string | null;
      related_sale_id: string | null;
      note: string | null;
    }> = await this.dataSource.query(`
      SELECT id, group_id, occurred_at, change_amount, reason,
             performed_by_backoffice_user_id, performed_by_name,
             related_sale_id, note
      FROM influencer_group_credit_ledger
    `);

    if (oldRows.length === 0) return;

    this.logger.log(
      `Migrating ${oldRows.length} legacy influencer credit ledger row(s)`,
    );

    for (const row of oldRows) {
      const member = await this.influencersRepo.findOne({
        where: { group_id: row.group_id },
        withDeleted: true,
      });
      if (!member) continue;

      let agencyId = member.agency_id ?? null;
      if (!agencyId && member.parent_influencer_id) {
        const parent = await this.influencersRepo.findOne({
          where: { id: member.parent_influencer_id },
          withDeleted: true,
        });
        if (parent?.agency_id) agencyId = parent.agency_id;
      }

      // Prefer an agency that was created from this group's parent shell
      if (!agencyId) {
        const siblingWithAgency = await this.influencersRepo.findOne({
          where: { group_id: row.group_id, agency_id: Not(IsNull()) },
          withDeleted: true,
        });
        agencyId = siblingWithAgency?.agency_id ?? null;
      }

      await this.ledgerRepo.save(
        this.ledgerRepo.create({
          influencer_id: member.id,
          agency_id: agencyId,
          occurred_at: row.occurred_at,
          change_amount: row.change_amount,
          reason: row.reason as InfluencerCreditLedgerEntry['reason'],
          performed_by_backoffice_user_id: row.performed_by_backoffice_user_id,
          performed_by_name: row.performed_by_name,
          related_sale_id: row.related_sale_id,
          note: row.note,
        }),
      );
    }
  }
}
