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
import { Product } from '../products/product.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicGroup, (group) => group.sales, { nullable: false })
  @JoinColumn({ name: 'group_id' })
  group: ClinicGroup;

  @Column({ type: 'uuid' })
  group_id: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.sales, { nullable: false })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column({ type: 'uuid' })
  clinic_id: string;

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

