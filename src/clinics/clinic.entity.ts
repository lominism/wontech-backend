import {
  Column,
  CreateDateColumn,
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
  address: string;

  @Column()
  contact_email: string;

  @OneToMany(() => Sale, (sale) => sale.clinic)
  sales: Sale[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

