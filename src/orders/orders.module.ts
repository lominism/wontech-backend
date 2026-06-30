import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ClinicGroupCreditLedgerEntry } from '../clinics/clinic-group-credit-ledger.entity';
import { ClinicsModule } from '../clinics/clinics.module';
import { ProductsModule } from '../products/products.module';
import { InventoryStock } from '../products/stock.entity';
import { Sale } from '../sales/sale.entity';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrdersAutoCompleteService } from './orders-auto-complete.service';
import { Order } from './order.entity';
import { LogisticsController } from './logistics.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { EmailService } from '../email/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      InventoryStock,
      Sale,
      ClinicGroupCreditLedgerEntry,
    ]),
    AuthModule,
    ProductsModule,
    ClinicsModule,
  ],
  controllers: [OrdersController, LogisticsController],
  providers: [
    OrdersService,
    OrderFulfillmentService,
    OrdersAutoCompleteService,
    EmailService,
  ],
  exports: [OrdersService, OrderFulfillmentService],
})
export class OrdersModule {}
