import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { ClinicsService } from '../clinics/clinics.service';
import { EmailService } from '../email/email.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { Order, OrderSource, OrderStatus } from '../orders/order.entity';
import { OrderFulfillmentService } from '../orders/order-fulfillment.service';
import { ProductsService } from '../products/products.service';

export type PublicShopProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  description: string | null;
  brand: string | null;
  weight: string | null;
  dimensions: string | null;
  origin: string | null;
  image: string | null;
  images: string[];
  inStock: boolean;
  stockAvailable: number;
};

export type PublicShopResponse = {
  clinic: { id: string; name: string };
  product: PublicShopProduct;
};

export type PublicTrackResponse = {
  orderNo: string;
  status: OrderStatus;
  productName: string;
  quantity: number;
  total: number;
  updatedAt: string;
  carrier: string | null;
  trackingNumber: string | null;
};

@Injectable()
export class PublicService {
  constructor(
    private readonly clinicsService: ClinicsService,
    private readonly productsService: ProductsService,
    private readonly emailService: EmailService,
    private readonly fulfillmentService: OrderFulfillmentService,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
  ) {}

  async getShopProduct(
    clinicId: string,
    productId: string,
  ): Promise<PublicShopResponse> {
    const clinic = await this.clinicsService.getById(clinicId);
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    const product = await this.productsService.getById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.is_active) {
      throw new NotFoundException('Product not found');
    }

    const stock = product.stock?.quantity_on_hand ?? 0;
    const images = product.image_urls ?? [];

    return {
      clinic: { id: clinic.id, name: clinic.name },
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: Number(product.price),
        description: product.description ?? null,
        brand: product.brand ?? null,
        weight: product.weight ?? null,
        dimensions: product.dimensions ?? null,
        origin: product.origin_country ?? null,
        image: images[0] ?? product.image_url ?? null,
        images,
        inStock: stock > 0,
        stockAvailable: stock,
      },
    };
  }

  async createOrder(dto: CreateOrderDto) {
    const shop = await this.getShopProduct(dto.clinicId, dto.productId);
    if (!shop.product.inStock) {
      throw new BadRequestException('Product is out of stock');
    }

    const quantity = Math.max(1, Number(dto.quantity ?? 1));
    const product = await this.productsService.getById(dto.productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const stock = product.stock?.quantity_on_hand ?? 0;
    if (stock < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const clinic = await this.clinicsService.getById(dto.clinicId);
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    const order = this.ordersRepo.create({
      order_no: await this.generateOrderNo(),
      clinic_id: dto.clinicId,
      product_id: dto.productId,
      customer_name: dto.customerName.trim(),
      customer_email: dto.customerEmail.trim(),
      customer_phone: dto.customerPhone.trim(),
      shipping_address_street: dto.shippingAddressStreet.trim(),
      shipping_address_city: dto.shippingAddressCity.trim(),
      shipping_address_code: dto.shippingAddressCode.trim(),
      quantity,
      unit_price_snapshot: product.price,
      commission_snapshot: product.commission_amount ?? null,
      status: OrderStatus.PENDING_PAYMENT,
      source: OrderSource.WONTECH,
      tracking_token: this.generateTrackingToken(),
    });

    const saved = await this.ordersRepo.save(order);

    return {
      orderId: saved.id,
      orderNo: saved.order_no,
      paymentUrl: `/shop/${dto.clinicId}/${dto.productId}/checkout/pay?orderId=${saved.id}`,
    };
  }

  async confirmPayment(orderId: string, frontendUrl: string) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: { product: true, clinic: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Order is not awaiting payment');
    }

    await this.fulfillmentService.decrementStock(
      order.product_id,
      order.quantity,
    );

    order.status = OrderStatus.AWAITING_SHIPMENT;
    order.payment_provider = 'stub';
    order.payment_reference = `stub_${randomBytes(8).toString('hex')}`;
    await this.ordersRepo.save(order);

    await this.fulfillmentService.recordSaleAndCommission(order);

    const total = Number(order.unit_price_snapshot) * order.quantity;
    const trackingUrl = `${frontendUrl}/track/${order.tracking_token}`;

    if (order.customer_email) {
      await this.emailService.sendOrderReceipt({
        to: order.customer_email,
        customerName: order.customer_name ?? 'Customer',
        orderNo: order.order_no,
        productName: order.product.name,
        quantity: order.quantity,
        total,
        trackingUrl,
      });
    }

    return {
      orderId: order.id,
      orderNo: order.order_no,
      trackingToken: order.tracking_token,
      trackingUrl,
    };
  }

  async getTracking(token: string): Promise<PublicTrackResponse> {
    const order = await this.ordersRepo.findOne({
      where: { tracking_token: token },
      relations: { product: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      orderNo: order.order_no,
      status: order.status,
      productName: order.product.name,
      quantity: order.quantity,
      total: Number(order.unit_price_snapshot) * order.quantity,
      updatedAt: order.updatedAt.toISOString(),
      carrier: order.carrier ?? null,
      trackingNumber: order.tracking_number ?? null,
    };
  }

  private async generateOrderNo(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.ordersRepo.count();
    return `WT-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private generateTrackingToken(): string {
    return randomBytes(16).toString('base64url');
  }
}
