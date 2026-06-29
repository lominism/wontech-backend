import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { ClinicsService } from '../clinics/clinics.service';
import { CreditLedgerReason } from '../clinics/clinic-group-credit-ledger.entity';
import { ClinicGroupCreditLedgerEntry } from '../clinics/clinic-group-credit-ledger.entity';
import { EmailService } from '../email/email.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { Order, OrderStatus } from '../orders/order.entity';
import { ProductsService } from '../products/products.service';
import { InventoryStock } from '../products/stock.entity';
import { Sale } from '../sales/sale.entity';

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
};

@Injectable()
export class PublicService {
  constructor(
    private readonly clinicsService: ClinicsService,
    private readonly productsService: ProductsService,
    private readonly emailService: EmailService,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(InventoryStock)
    private readonly stockRepo: Repository<InventoryStock>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    @InjectRepository(ClinicGroupCreditLedgerEntry)
    private readonly ledgerRepo: Repository<ClinicGroupCreditLedgerEntry>,
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

    const stock = await this.stockRepo.findOne({
      where: { product_id: order.product_id },
    });
    if (!stock || stock.quantity_on_hand < order.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    stock.quantity_on_hand -= order.quantity;
    await this.stockRepo.save(stock);

    order.status = OrderStatus.AWAITING_SHIPMENT;
    order.payment_provider = 'stub';
    order.payment_reference = `stub_${randomBytes(8).toString('hex')}`;
    await this.ordersRepo.save(order);

    const purchasedOn = new Date().toISOString().slice(0, 10);
    const sale = this.salesRepo.create({
      group_id: order.clinic.group_id,
      clinic_id: order.clinic_id,
      product_id: order.product_id,
      purchased_on: purchasedOn,
      quantity: order.quantity,
      unit_price_snapshot: order.unit_price_snapshot,
      commission_snapshot: order.commission_snapshot ?? null,
    });
    const savedSale = await this.salesRepo.save(sale);

    if (order.commission_snapshot) {
      const commissionTotal =
        Number(order.commission_snapshot) * order.quantity;
      const ledger = this.ledgerRepo.create({
        group_id: order.clinic.group_id,
        occurred_at: new Date(),
        change_amount: String(commissionTotal),
        reason: CreditLedgerReason.COMMISSION,
        related_sale_id: savedSale.id,
        note: `Commission for order ${order.order_no}`,
      });
      await this.ledgerRepo.save(ledger);
    }

    const total = Number(order.unit_price_snapshot) * order.quantity;
    const trackingUrl = `${frontendUrl}/track/${order.tracking_token}`;

    await this.emailService.sendOrderReceipt({
      to: order.customer_email,
      customerName: order.customer_name,
      orderNo: order.order_no,
      productName: order.product.name,
      quantity: order.quantity,
      total,
      trackingUrl,
    });

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
