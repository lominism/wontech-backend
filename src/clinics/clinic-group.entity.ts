import {
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { Clinic } from './clinic.entity';
import { ClinicUser } from './clinic-user.entity';
import { ClinicInvite } from './clinic-invite.entity';
import { ClinicGroupCreditLedgerEntry } from './clinic-group-credit-ledger.entity';
import { Sale } from '../sales/sale.entity';

@Entity('clinic_groups')
export class ClinicGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @OneToMany(() => Clinic, (clinic) => clinic.group)
  clinics: Clinic[];

  @OneToMany(() => ClinicUser, (user) => user.group)
  clinicUsers: ClinicUser[];

  @OneToMany(() => ClinicInvite, (invite) => invite.group)
  invites: ClinicInvite[];

  @OneToMany(
    () => ClinicGroupCreditLedgerEntry,
    (entry) => entry.group,
  )
  creditLedgerEntries: ClinicGroupCreditLedgerEntry[];

  @OneToMany(() => Sale, (sale) => sale.group)
  sales: Sale[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

