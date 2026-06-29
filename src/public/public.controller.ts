import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

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

  @Post('payments/confirm')
  confirmPayment(
    @Body('orderId') orderId: string,
    @Headers('x-frontend-url') frontendUrl?: string,
  ) {
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
