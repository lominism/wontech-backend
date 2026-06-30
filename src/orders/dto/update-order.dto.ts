import { OrderStatus } from '../order.entity';

export class UpdateOrderDto {
  status: OrderStatus.SHIPPED | OrderStatus.CANCELLED;
}
