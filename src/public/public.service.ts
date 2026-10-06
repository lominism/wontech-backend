import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { ClinicsService } from '../clinics/clinics.service';
import { EmailService } from '../email/email.service';
import { InfluencersService } from '../influencers/influencers.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { Order, OrderSource, OrderStatus } from '../orders/order.entity';
import { OrderFulfillmentService } from '../orders/order-fulfillment.service';
import { ProductsService } from '../products/products.service';
import { StripeService } from '../stripe/stripe.service';

export type PublicShopProduct = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
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

export type PaymentStatusResponse = {
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  orderNo?: string;
  trackingToken?: string;
};

@Injectable()
export class PublicService {
  constructor(
    private readonly clinicsService: ClinicsService,
    private readonly influencersService: InfluencersService,
    private readonly productsService: ProductsService,
    private readonly emailService: EmailService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly stripeService: StripeService,
    private readonly config: ConfigService,
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

    return this.buildShopResponse(clinic, productId);
  }

  async getInfluencerShopProduct(
    influencerId: string,
    productId: string,
  ): Promise<PublicShopResponse> {
    const influencer = await this.influencersService.getById(influencerId);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    return this.buildShopResponse(influencer, productId);
  }

  async listStorefrontProducts(): Promise<PublicShopProduct[]> {
    const products = await this.productsService.list();
    return products
      .filter((product) => product.is_active)
      .map((product) => {
        const stock = product.stock?.quantity_on_hand ?? 0;
        const images = product.image_urls ?? [];
        return this.toPublicProduct(product, stock, images);
      });
  }

  async getStorefrontProduct(productId: string): Promise<PublicShopProduct> {
    const product = await this.productsService.getById(productId);
    if (!product || !product.is_active) {
      throw new NotFoundException('Product not found');
    }

    const stock = product.stock?.quantity_on_hand ?? 0;
    const images = product.image_urls ?? [];
    return this.toPublicProduct(product, stock, images);
  }

  private async buildShopResponse(
    partner: { id: string; name: string },
    productId: string,
  ): Promise<PublicShopResponse> {
    const product = await this.productsService.getById(productId);
    if (!product || !product.is_active) {
      throw new NotFoundException('Product not found');
    }

    const stock = product.stock?.quantity_on_hand ?? 0;
    const images = product.image_urls ?? [];

    return {
      clinic: { id: partner.id, name: partner.name },
      product: this.toPublicProduct(product, stock, images),
    };
  }

  private toPublicProduct(
    product: {
      id: string;
      name: string;
      sku: string;
      category: string | null;
      price: string;
      description?: string | null;
      brand?: string | null;
      weight?: string | null;
      dimensions?: string | null;
      origin_country?: string | null;
      image_url?: string | null;
    },
    stock: number,
    images: string[],
  ): PublicShopProduct {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category ?? null,
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
    };
  }

  async createOrder(dto: CreateOrderDto) {
    const clinicId = dto.clinicId?.trim() || null;
    const influencerId = dto.influencerId?.trim() || null;
    const isStorefront = !clinicId && !influencerId;

    if (clinicId && influencerId) {
      throw new BadRequestException(
        'An order can be attributed to a clinic or an influencer, not both',
      );
    }

    let productView: PublicShopProduct;
    if (isStorefront) {
      productView = await this.getStorefrontProduct(dto.productId);
    } else if (influencerId) {
      productView = (
        await this.getInfluencerShopProduct(influencerId, dto.productId)
      ).product;
    } else {
      productView = (await this.getShopProduct(clinicId!, dto.productId))
        .product;
    }

    if (!productView.inStock) {
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

    const commissionSnapshot = isStorefront
      ? null
      : influencerId
        ? (product.kol_commission_amount ?? null)
        : (product.commission_amount ?? null);

    const order = this.ordersRepo.create({
      order_no: await this.generateOrderNo(),
      clinic_id: isStorefront || influencerId ? null : clinicId,
      influencer_id: influencerId,
      product_id: dto.productId,
      customer_name: dto.customerName.trim(),
      customer_email: dto.customerEmail.trim(),
      customer_phone: dto.customerPhone.trim(),
      shipping_address_street: dto.shippingAddressStreet.trim(),
      shipping_address_street_2: dto.shippingAddressStreet2?.trim() || null,
      shipping_address_city: dto.shippingAddressCity.trim(),
      shipping_address_code: dto.shippingAddressCode.trim(),
      quantity,
      unit_price_snapshot: product.price,
      commission_snapshot: commissionSnapshot,
      status: OrderStatus.PENDING_PAYMENT,
      source: isStorefront ? OrderSource.STOREFRONT : OrderSource.WONTECH,
      tracking_token: this.generateTrackingToken(),
    });

    const saved = await this.ordersRepo.save(order);

    const paymentUrl = isStorefront
      ? `/storefront/${dto.productId}/checkout/pay?orderId=${saved.id}`
      : `/shop/${
          influencerId ? `influencer/${influencerId}` : clinicId
        }/${dto.productId}/checkout/pay?orderId=${saved.id}`;

    return {
      orderId: saved.id,
      orderNo: saved.order_no,
      paymentUrl,
    };
  }

  async createCheckoutSession(
    orderId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ checkoutUrl: string }> {
    this.assertAllowedRedirectUrl(successUrl);
    this.assertAllowedRedirectUrl(cancelUrl);

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

    const product = await this.productsService.getById(order.product_id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const stock = product.stock?.quantity_on_hand ?? 0;
    if (stock < order.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const unitAmountSatang = Math.round(Number(order.unit_price_snapshot) * 100);
    if (unitAmountSatang <= 0) {
      throw new BadRequestException('Invalid order amount');
    }

    const session = await this.stripeService.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: order.customer_email ?? undefined,
      line_items: [
        {
          quantity: order.quantity,
          price_data: {
            currency: 'thb',
            unit_amount: unitAmountSatang,
            product_data: {
              name: order.product.name,
            },
          },
        },
      ],
      metadata: { orderId: order.id },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create checkout session');
    }

    order.payment_provider = 'stripe';
    order.payment_reference = session.id;
    await this.ordersRepo.save(order);

    return { checkoutUrl: session.url };
  }

  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResponse> {
    const session =
      await this.stripeService.stripe.checkout.sessions.retrieve(sessionId);

    const orderId = session.metadata?.orderId;
    if (!orderId) {
      throw new NotFoundException('Order not found for session');
    }

    if (session.payment_status === 'paid') {
      await this.fulfillPaidOrder(orderId, 'stripe', session.id);
    }

    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return {
        status: 'paid',
        orderNo: order.order_no,
        trackingToken: order.tracking_token,
      };
    }

    if (session.status === 'expired') {
      return { status: 'failed' };
    }

    return { status: 'pending' };
  }

  async fulfillPaidOrder(
    orderId: string,
    provider: string,
    reference: string,
  ): Promise<void> {
    const paid = await this.fulfillmentService.settlePaidOrder(
      orderId,
      provider,
      reference,
    );

    if (!paid?.customer_email || !paid.product) {
      return;
    }

    const total = Number(paid.unit_price_snapshot) * paid.quantity;
    const frontendUrl = this.getDefaultFrontendUrl();
    const trackingUrl = `${frontendUrl}/track/${paid.tracking_token}`;

    await this.emailService.sendOrderReceipt({
      to: paid.customer_email,
      customerName: paid.customer_name ?? 'Customer',
      orderNo: paid.order_no,
      productName: paid.product.name,
      quantity: paid.quantity,
      total,
      trackingUrl,
    });
  }

  async confirmPayment(orderId: string, frontendUrl: string) {
    await this.fulfillPaidOrder(
      orderId,
      'stub',
      `stub_${randomBytes(8).toString('hex')}`,
    );

    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: { product: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const trackingUrl = `${frontendUrl}/track/${order.tracking_token}`;

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

  private assertAllowedRedirectUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid redirect URL');
    }

    const allowedOrigins = this.getAllowedFrontendOrigins();
    const origin = parsed.origin;
    if (!allowedOrigins.includes(origin)) {
      throw new BadRequestException('Redirect URL origin is not allowed');
    }
  }

  private getAllowedFrontendOrigins(): string[] {
    const fromList = this.config.get<string>('FRONTEND_URLS');
    if (fromList) {
      return fromList
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    const single = this.config.get<string>('FRONTEND_URL');
    if (single) {
      return [single.trim()];
    }

    return ['http://localhost:3000'];
  }

  private getDefaultFrontendUrl(): string {
    const origins = this.getAllowedFrontendOrigins();
    return origins[0] ?? 'http://localhost:3000';
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
