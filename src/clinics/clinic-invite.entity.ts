import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { ClinicGroup } from './clinic-group.entity';
import { Clinic } from './clinic.entity';
import { User } from '../users/user.entity';

@Entity('clinic_invites')
export class ClinicInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicGroup, (group) => group.invites, { nullable: false })
  @JoinColumn({ name: 'group_id' })
  group: ClinicGroup;

  @Column({ type: 'uuid' })
  group_id: string;

  @ManyToOne(() => Clinic, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Clinic | null;

  @Column({ type: 'uuid', nullable: true })
  clinic_id?: string | null;

  @Column()
  email: string;

  @Column()
  token_hash: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  accepted_at?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at?: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_backoffice_user_id' })
  createdByBackofficeUser?: User | null;

  @Column({ type: 'uuid', nullable: true })
  created_by_backoffice_user_id?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

