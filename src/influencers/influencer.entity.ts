import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Agency } from '../agencies/agency.entity';
import { Sale } from '../sales/sale.entity';

@Entity('influencers')
export class Influencer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Agency, (agency) => agency.influencers, {
    nullable: true,
  })
  @JoinColumn({ name: 'agency_id' })
  agency?: Agency | null;

  @Column({ type: 'uuid', nullable: true })
  agency_id?: string | null;

  /**
   * Deprecated: kept nullable so synchronize does not drop the column
   * before OnModuleInit can migrate parent shells → agencies.
   */
  @Column({ type: 'uuid', nullable: true })
  parent_influencer_id?: string | null;

  /**
   * Deprecated: kept nullable for ledger/group migration compatibility.
   */
  @Column({ type: 'uuid', nullable: true })
  group_id?: string | null;

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

  @Column({ type: 'text', nullable: true })
  contact_phone: string | null;

  @OneToMany(() => Sale, (sale) => sale.influencer)
  sales: Sale[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
