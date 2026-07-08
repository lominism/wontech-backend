import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { ClinicGroup } from './clinic-group.entity';
import { Sale } from '../sales/sale.entity';

@Entity('clinics')
export class Clinic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicGroup, (group) => group.clinics, { nullable: false })
  @JoinColumn({ name: 'group_id' })
  group: ClinicGroup;

  @Column({ type: 'uuid' })
  group_id: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.children, { nullable: true })
  @JoinColumn({ name: 'parent_clinic_id' })
  parentClinic?: Clinic | null;

  @Column({ type: 'uuid', nullable: true })
  parent_clinic_id?: string | null;

  @OneToMany(() => Clinic, (clinic) => clinic.parentClinic)
  children: Clinic[];

  @Column()
  name: string;

  @Column()
  address_street: string;

  @Column()
  address_city: string;

  @Column()
  address_code: string;

  @Column()
  contact_email: string;

  // Nullable so existing clinic rows remain valid when the column is added.
  @Column({ type: 'text', nullable: true })
  contact_phone: string | null;

  @OneToMany(() => Sale, (sale) => sale.clinic)
  sales: Sale[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}

