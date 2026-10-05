import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Sale } from '../sales/sale.entity';
import { InfluencerGroup } from './influencer-group.entity';

export enum InfluencerCreditLedgerReason {
  COMMISSION = 'commission',
  ADJUSTMENT = 'adjustment',
  REDEMPTION = 'redemption',
}

@Entity('influencer_group_credit_ledger')
export class InfluencerGroupCreditLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InfluencerGroup, (group) => group.creditLedgerEntries, {
    nullable: false,
  })
  @JoinColumn({ name: 'group_id' })
  group: InfluencerGroup;

  @Column({ type: 'uuid' })
  group_id: string;

  @Column({ type: 'timestamptz' })
  occurred_at: Date;

  @Column({ type: 'numeric' })
  change_amount: string;

  @Column({ type: 'enum', enum: InfluencerCreditLedgerReason })
  reason: InfluencerCreditLedgerReason;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performed_by_backoffice_user_id' })
  performedByBackofficeUser?: User | null;

  @Column({ type: 'uuid', nullable: true })
  performed_by_backoffice_user_id?: string | null;

  @Column({ type: 'text', nullable: true })
  performed_by_name?: string | null;

  @ManyToOne(() => Sale, { nullable: true })
  @JoinColumn({ name: 'related_sale_id' })
  relatedSale?: Sale | null;

  @Column({ type: 'uuid', nullable: true })
  related_sale_id?: string | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
