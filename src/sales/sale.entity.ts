import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClinicGroup } from '../clinics/clinic-group.entity';
import { Clinic } from '../clinics/clinic.entity';
import { InfluencerGroup } from '../influencers/influencer-group.entity';
import { Influencer } from '../influencers/influencer.entity';
import { Product } from '../products/product.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicGroup, (group) => group.sales, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group?: ClinicGroup | null;

  @Column({ type: 'uuid', nullable: true })
  group_id?: string | null;

  @ManyToOne(() => Clinic, (clinic) => clinic.sales, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Clinic | null;

  @Column({ type: 'uuid', nullable: true })
  clinic_id?: string | null;

  @ManyToOne(() => InfluencerGroup, (group) => group.sales, { nullable: true })
  @JoinColumn({ name: 'influencer_group_id' })
  influencerGroup?: InfluencerGroup | null;

  @Column({ type: 'uuid', nullable: true })
  influencer_group_id?: string | null;

  @ManyToOne(() => Influencer, (influencer) => influencer.sales, {
    nullable: true,
  })
  @JoinColumn({ name: 'influencer_id' })
  influencer?: Influencer | null;

  @Column({ type: 'uuid', nullable: true })
  influencer_id?: string | null;

  @Column({ type: 'uuid', nullable: true, unique: true })
  order_id?: string | null;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'date' })
  purchased_on: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'numeric' })
  unit_price_snapshot: string;

  @Column({ type: 'numeric', nullable: true })
  commission_snapshot?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

