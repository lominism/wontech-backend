import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { Order } from '../orders/order.entity';
import { Sale } from '../sales/sale.entity';
import { Product } from './product.entity';
import { InventoryStock } from './stock.entity';
import { InventoryStockLedgerEntry } from './inventory-stock-ledger.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      InventoryStock,
      InventoryStockLedgerEntry,
      Order,
      Sale,
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
