import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Clinic } from '../clinics/clinic.entity';
import { Product } from '../products/product.entity';

export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  AWAITING_SHIPMENT = 'awaiting_shipment',
  SHIPPED = 'shipped',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum OrderSource {
  WONTECH = 'wontech',
  LAZADA = 'lazada',
  SHOPEE = 'shopee',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  order_no: string;

  @ManyToOne(() => Clinic, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Clinic | null;

  @Column({ type: 'uuid', nullable: true })
  clinic_id?: string | null;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'varchar', nullable: true })
  customer_name?: string | null;

  @Column({ type: 'varchar', nullable: true })
  customer_email?: string | null;

  @Column({ type: 'varchar', nullable: true })
  customer_phone?: string | null;

  @Column({ type: 'varchar', nullable: true })
  shipping_address_street?: string | null;

  @Column({ type: 'varchar', nullable: true })
  shipping_address_city?: string | null;

  @Column({ type: 'varchar', nullable: true })
  shipping_address_code?: string | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'numeric' })
  unit_price_snapshot: string;

  @Column({ type: 'numeric', nullable: true })
  commission_snapshot?: string | null;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING_PAYMENT,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: OrderSource,
    default: OrderSource.WONTECH,
  })
  source: OrderSource;

  @Column({ unique: true })
  tracking_token: string;

  @Column({ type: 'text', nullable: true })
  payment_provider?: string | null;

  @Column({ type: 'text', nullable: true })
  payment_reference?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  shipped_at?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  carrier?: string | null;

  @Column({ type: 'varchar', nullable: true })
  tracking_number?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
