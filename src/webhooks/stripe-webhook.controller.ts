import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PublicService } from '../public/public.service';
import { StripeService } from '../stripe/stripe.service';
import Stripe from 'stripe';

@Controller('webhooks')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly publicService: PublicService,
  ) {}

  @Post('stripe')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId && session.payment_status === 'paid') {
        await this.publicService.fulfillPaidOrder(
          orderId,
          'stripe',
          session.id,
        );
      }
    }

    return { received: true };
  }
}
