import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { ClinicGroup } from './clinic-group.entity';
import { User } from '../users/user.entity';
import { ClinicUser } from './clinic-user.entity';
import { Sale } from '../sales/sale.entity';

export enum CreditLedgerReason {
  COMMISSION = 'commission',
  ADJUSTMENT = 'adjustment',
  REDEMPTION = 'redemption',
}

@Entity('clinic_group_credit_ledger')
export class ClinicGroupCreditLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicGroup, (group) => group.creditLedgerEntries, {
    nullable: false,
  })
  @JoinColumn({ name: 'group_id' })
  group: ClinicGroup;

  @Column({ type: 'uuid' })
  group_id: string;

  @Column({ type: 'timestamptz' })
  occurred_at: Date;

  @Column({ type: 'numeric' })
  change_amount: string;

  @Column({ type: 'enum', enum: CreditLedgerReason })
  reason: CreditLedgerReason;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by_backoffice_user_id' })
  performedByBackofficeUser?: User | null;

  @Column({ type: 'uuid', nullable: true })
  performed_by_backoffice_user_id?: string | null;

  @ManyToOne(() => ClinicUser, { nullable: true })
  @JoinColumn({ name: 'performed_by_clinic_user_id' })
  performedByClinicUser?: ClinicUser | null;

  @Column({ type: 'uuid', nullable: true })
  performed_by_clinic_user_id?: string | null;

  @ManyToOne(() => Sale, { nullable: true })
  @JoinColumn({ name: 'related_sale_id' })
  relatedSale?: Sale | null;

  @Column({ type: 'uuid', nullable: true })
  related_sale_id?: string | null;

  // NOTE: With TypeORM + emitDecoratorMetadata, `string | null` may reflect as
  // `Object` at runtime. Always specify `type: 'text'` for nullable strings.
  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

