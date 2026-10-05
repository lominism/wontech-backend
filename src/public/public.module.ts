import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicsModule } from '../clinics/clinics.module';
import { InfluencersModule } from '../influencers/influencers.module';
import { OrderFulfillmentService } from '../orders/order-fulfillment.service';
import { OrdersModule } from '../orders/orders.module';
import { Order } from '../orders/order.entity';
import { ProductsModule } from '../products/products.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { EmailService } from '../email/email.service';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [
    ClinicsModule,
    InfluencersModule,
    ProductsModule,
    OrdersModule,
    StripeModule,
    TypeOrmModule.forFeature([Order]),
  ],
  controllers: [PublicController],
  providers: [PublicService, EmailService],
  exports: [PublicService],
})
export class PublicModule {}
