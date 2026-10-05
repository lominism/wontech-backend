export class CreateOrderDto {
  clinicId?: string;
  influencerId?: string;
  productId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddressStreet: string;
  shippingAddressStreet2?: string;
  shippingAddressCity: string;
  shippingAddressCode: string;
  quantity?: number;
}
