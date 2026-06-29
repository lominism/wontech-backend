export class CreateOrderDto {
  clinicId: string;
  productId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddressStreet: string;
  shippingAddressCity: string;
  shippingAddressCode: string;
  quantity?: number;
}
