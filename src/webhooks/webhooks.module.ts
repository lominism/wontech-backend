import { Module } from '@nestjs/common';
import { PublicModule } from '../public/public.module';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [PublicModule],
  controllers: [StripeWebhookController],
})
export class WebhooksModule {}
