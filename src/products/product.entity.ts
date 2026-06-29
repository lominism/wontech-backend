import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InventoryStock } from './stock.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ type: 'numeric' })
  price: string;

  @Column({ type: 'numeric', nullable: true })
  commission_amount?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // NOTE: With TypeORM + emitDecoratorMetadata, `string | null` may reflect as
  // `Object` at runtime. Always specify `type: 'text'` for these nullable strings.
  @Column({ type: 'text', nullable: true })
  brand?: string | null;

  @Column({ type: 'text', nullable: true })
  weight?: string | null;

  @Column({ type: 'text', nullable: true })
  dimensions?: string | null;

  @Column({ type: 'text', nullable: true })
  origin_country?: string | null;

  @Column({ type: 'text', nullable: true })
  image_url?: string | null;

  @Column({ type: 'jsonb', default: [] })
  image_urls: string[];

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToOne(() => InventoryStock, (stock) => stock.product)
  stock: InventoryStock;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

