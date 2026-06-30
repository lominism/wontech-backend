import { OrderSource, OrderStatus } from '../order.entity';

export class CreateManualOrderDto {
  source: OrderSource;
  productId: string;
  quantity?: number;
  status: OrderStatus;
  clinicId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  shippingAddressStreet?: string | null;
  shippingAddressCity?: string | null;
  shippingAddressCode?: string | null;
}
