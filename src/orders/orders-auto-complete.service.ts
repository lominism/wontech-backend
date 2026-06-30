import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './order.entity';

@Injectable()
export class OrdersAutoCompleteService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
  ) {}

  @Cron('0 3 * * *')
  async handleCron(): Promise<void> {
    await this.autoCompleteShippedOrders();
  }

  async autoCompleteShippedOrders(): Promise<void> {
    await this.ordersRepo
      .createQueryBuilder()
      .update(Order)
      .set({ status: OrderStatus.COMPLETED })
      .where('status = :shipped', { shipped: OrderStatus.SHIPPED })
      .andWhere('shipped_at IS NOT NULL')
      .andWhere("shipped_at < NOW() - INTERVAL '1 month'")
      .execute();
  }
}
