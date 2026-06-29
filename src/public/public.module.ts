import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicsModule } from '../clinics/clinics.module';
import { ClinicGroupCreditLedgerEntry } from '../clinics/clinic-group-credit-ledger.entity';
import { EmailService } from '../email/email.service';
import { Order } from '../orders/order.entity';
import { ProductsModule } from '../products/products.module';
import { InventoryStock } from '../products/stock.entity';
import { Sale } from '../sales/sale.entity';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [
    ClinicsModule,
    ProductsModule,
    TypeOrmModule.forFeature([
      Order,
      InventoryStock,
      Sale,
      ClinicGroupCreditLedgerEntry,
    ]),
  ],
  controllers: [PublicController],
  providers: [PublicService, EmailService],
})
export class PublicModule {}
