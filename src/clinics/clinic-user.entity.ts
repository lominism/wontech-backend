import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { ClinicGroup } from './clinic-group.entity';

export enum ClinicUserRole {
  OWNER = 'owner',
  MEMBER = 'member',
}

@Entity('clinic_users')
export class ClinicUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  firebaseUid: string;

  @Column({ unique: true })
  email: string;

  @ManyToOne(() => ClinicGroup, (group) => group.clinicUsers, {
    nullable: false,
  })
  @JoinColumn({ name: 'group_id' })
  group: ClinicGroup;

  @Column({ type: 'uuid' })
  group_id: string;

  @Column({ type: 'enum', enum: ClinicUserRole, default: ClinicUserRole.MEMBER })
  role: ClinicUserRole;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

