import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('shop/influencer/:influencerId/:productId')
  getInfluencerShopProduct(
    @Param('influencerId') influencerId: string,
    @Param('productId') productId: string,
  ) {
    return this.publicService.getInfluencerShopProduct(influencerId, productId);
  }

  @Get('shop/:clinicId/:productId')
  getShopProduct(
    @Param('clinicId') clinicId: string,
    @Param('productId') productId: string,
  ) {
    return this.publicService.getShopProduct(clinicId, productId);
  }

  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.publicService.createOrder(dto);
  }

  @Post('payments/checkout-session')
  createCheckoutSession(
    @Body('orderId') orderId: string,
    @Body('successUrl') successUrl: string,
    @Body('cancelUrl') cancelUrl: string,
  ) {
    return this.publicService.createCheckoutSession(
      orderId,
      successUrl,
      cancelUrl,
    );
  }

  @Get('payments/status')
  getPaymentStatus(@Query('session_id') sessionId: string) {
    return this.publicService.getPaymentStatus(sessionId);
  }

  @Post('payments/confirm')
  confirmPayment(
    @Body('orderId') orderId: string,
    @Headers('x-frontend-url') frontendUrl?: string,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Stub payment confirmation is disabled in production',
      );
    }

    return this.publicService.confirmPayment(
      orderId,
      frontendUrl ?? 'http://localhost:3000',
    );
  }

  @Get('track/:token')
  getTracking(@Param('token') token: string) {
    return this.publicService.getTracking(token);
  }
}
