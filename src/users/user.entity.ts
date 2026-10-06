import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
}

export enum PreferredLocale {
  EN = 'en',
  TH = 'th',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  firebaseUid: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  firstName: string | null;

  @Column({ type: 'text', nullable: true })
  lastName: string | null;

  // NOTE: With TypeORM + emitDecoratorMetadata, `string | null` may reflect as
  // `Object` at runtime. Always specify `type: 'text'` for these nullable strings.
  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({
    type: 'varchar',
    length: 5,
    default: PreferredLocale.TH,
  })
  preferredLocale: PreferredLocale;

  @Column({ type: 'varchar', length: 20, default: UserRole.ADMIN })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
