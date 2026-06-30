import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Clinic } from '../clinics/clinic.entity';
import { OrdersModule } from '../orders/orders.module';
import { Order } from '../orders/order.entity';
import { Sale } from '../sales/sale.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Clinic, Sale]),
    AuthModule,
    OrdersModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
