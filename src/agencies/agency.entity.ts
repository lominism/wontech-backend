import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Influencer } from '../influencers/influencer.entity';
import { InfluencerCreditLedgerEntry } from '../influencers/influencer-credit-ledger.entity';

@Entity('agencies')
export class Agency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @OneToMany(() => Influencer, (influencer) => influencer.agency)
  influencers: Influencer[];

  @OneToMany(() => InfluencerCreditLedgerEntry, (entry) => entry.agency)
  creditLedgerEntries: InfluencerCreditLedgerEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
