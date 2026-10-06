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
import { Agency } from '../agencies/agency.entity';
import { Influencer } from './influencer.entity';

export enum InfluencerCreditLedgerReason {
  COMMISSION = 'commission',
  ADJUSTMENT = 'adjustment',
  REDEMPTION = 'redemption',
}

@Entity('influencer_credit_ledger')
export class InfluencerCreditLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Influencer, { nullable: false })
  @JoinColumn({ name: 'influencer_id' })
  influencer: Influencer;

  @Column({ type: 'uuid' })
  influencer_id: string;

  @ManyToOne(() => Agency, (agency) => agency.creditLedgerEntries, {
    nullable: true,
  })
  @JoinColumn({ name: 'agency_id' })
  agency?: Agency | null;

  @Column({ type: 'uuid', nullable: true })
  agency_id?: string | null;

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
