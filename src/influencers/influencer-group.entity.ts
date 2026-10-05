import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Influencer } from './influencer.entity';
import { InfluencerGroupCreditLedgerEntry } from './influencer-group-credit-ledger.entity';
import { Sale } from '../sales/sale.entity';

@Entity('influencer_groups')
export class InfluencerGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @OneToMany(() => Influencer, (influencer) => influencer.group)
  influencers: Influencer[];

  @OneToMany(
    () => InfluencerGroupCreditLedgerEntry,
    (entry) => entry.group,
  )
  creditLedgerEntries: InfluencerGroupCreditLedgerEntry[];

  @OneToMany(() => Sale, (sale) => sale.influencerGroup)
  sales: Sale[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
