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
import { InfluencerGroup } from './influencer-group.entity';
import { Sale } from '../sales/sale.entity';

@Entity('influencers')
export class Influencer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InfluencerGroup, (group) => group.influencers, {
    nullable: false,
  })
  @JoinColumn({ name: 'group_id' })
  group: InfluencerGroup;

  @Column({ type: 'uuid' })
  group_id: string;

  @ManyToOne(() => Influencer, (influencer) => influencer.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_influencer_id' })
  parentInfluencer?: Influencer | null;

  @Column({ type: 'uuid', nullable: true })
  parent_influencer_id?: string | null;

  @OneToMany(() => Influencer, (influencer) => influencer.parentInfluencer)
  children: Influencer[];

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
