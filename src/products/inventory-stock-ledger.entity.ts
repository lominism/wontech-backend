import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Product } from './product.entity';

@Entity('inventory_stock_ledger')
export class InventoryStockLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'int' })
  quantity_before: number;

  @Column({ type: 'int' })
  quantity_after: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performed_by_backoffice_user_id' })
  performedByBackofficeUser?: User | null;

  @Column({ type: 'uuid', nullable: true })
  performed_by_backoffice_user_id?: string | null;

  @Column({ type: 'text', nullable: true })
  performed_by_name?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
