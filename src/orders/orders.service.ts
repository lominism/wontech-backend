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
import { ProductsService } from '../products/products.service';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrdersAutoCompleteService } from './orders-auto-complete.service';
import { Order, OrderSource, OrderStatus } from './order.entity';

export type OrderListItem = {
  id: string;
  orderNo: string;
  date: string;
  customer: string;
  clinic: string;
  item: string;
  qty: number;
  status: OrderStatus;
  total: number;
  source: OrderSource;
};

export type OrderListResult = {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type OrderDetail = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  source: OrderSource;
  createdAt: string;
  updatedAt: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  clinicId: string | null;
  clinicName: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddressStreet: string | null;
  shippingAddressCity: string | null;
  shippingAddressCode: string | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  trackingToken: string;
  carrier: string | null;
  trackingNumber: string | null;
};

export type LogisticsListItem = {
  id: string;
  orderNo: string;
  date: string;
  customer: string;
  item: string;
  qty: number;
  status: OrderStatus;
};

export type LogisticsListResult = {
  items: LogisticsListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const MANUAL_STATUSES = new Set<OrderStatus>([
  OrderStatus.AWAITING_SHIPMENT,
  OrderStatus.SHIPPED,
  OrderStatus.COMPLETED,
]);

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    private readonly productsService: ProductsService,
    private readonly clinicsService: ClinicsService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly autoCompleteService: OrdersAutoCompleteService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async list(
    search?: string,
    status?: string,
    page = 1,
    pageSize = 10,
    sortBy?: string,
    sortDir?: string,
  ): Promise<OrderListResult> {
    await this.autoCompleteService.autoCompleteShippedOrders();

    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 10));

    const qb = this.ordersRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.clinic', 'clinic')
      .leftJoinAndSelect('order.product', 'product');

    this.applyOrderSort(qb, sortBy, sortDir);

    if (status === OrderStatus.COMPLETED) {
      qb.andWhere('order.status = :status', { status: OrderStatus.COMPLETED });
    } else if (!status || status === 'all') {
      qb.andWhere('order.status != :completed', {
        completed: OrderStatus.COMPLETED,
      });
    } else {
      qb.andWhere('order.status = :status', { status });
    }

    const query = search?.trim().toLowerCase();
    if (query) {
      qb.andWhere(
        '(LOWER(order.order_no) LIKE :query OR LOWER(COALESCE(order.customer_name, \'\')) LIKE :query)',
        { query: `%${query}%` },
      );
    }

    const [orders, total] = await qb
      .skip((safePage - 1) * safePageSize)
      .take(safePageSize)
      .getManyAndCount();

    return {
      items: orders.map((order) => this.toListItem(order)),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async listLogistics(
    search?: string,
    status?: string,
    page = 1,
    pageSize = 10,
    sortBy?: string,
    sortDir?: string,
  ): Promise<LogisticsListResult> {
    await this.autoCompleteService.autoCompleteShippedOrders();

    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 10));

    const qb = this.ordersRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.product', 'product')
      .where('order.status IN (:...statuses)', {
        statuses: [OrderStatus.AWAITING_SHIPMENT, OrderStatus.SHIPPED],
      });

    this.applyLogisticsSort(qb, sortBy, sortDir);

    if (
      status &&
      status !== 'all' &&
      (status === OrderStatus.AWAITING_SHIPMENT ||
        status === OrderStatus.SHIPPED)
    ) {
      qb.andWhere('order.status = :status', { status });
    }

    const query = search?.trim().toLowerCase();
    if (query) {
      qb.andWhere(
        '(LOWER(order.order_no) LIKE :query OR LOWER(COALESCE(order.customer_name, \'\')) LIKE :query)',
        { query: `%${query}%` },
      );
    }

    const [orders, total] = await qb
      .skip((safePage - 1) * safePageSize)
      .take(safePageSize)
      .getManyAndCount();

    return {
      items: orders.map((order) => this.toLogisticsListItem(order)),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async createManual(dto: CreateManualOrderDto): Promise<OrderListItem> {
    this.validateManualOrder(dto);

    const quantity = Math.max(1, Number(dto.quantity ?? 1));
    const product = await this.productsService.getById(dto.productId);
    if (!product || !product.is_active) {
      throw new NotFoundException('Product not found');
    }

    const stock = product.stock?.quantity_on_hand ?? 0;
    if (stock < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    if (dto.clinicId) {
      const foundClinic = await this.clinicsService.getById(dto.clinicId);
      if (!foundClinic) {
        throw new NotFoundException('Clinic not found');
      }
    }

    const now = new Date();
    const status = dto.status;
    const shippedAt =
      status === OrderStatus.SHIPPED || status === OrderStatus.COMPLETED
        ? now
        : null;

    const order = this.ordersRepo.create({
      order_no: await this.generateOrderNo(),
      clinic_id: dto.clinicId ?? null,
      product_id: dto.productId,
      customer_name: this.optionalTrim(dto.customerName),
      customer_email: this.optionalTrim(dto.customerEmail),
      customer_phone: this.optionalTrim(dto.customerPhone),
      shipping_address_street: this.optionalTrim(dto.shippingAddressStreet),
      shipping_address_city: this.optionalTrim(dto.shippingAddressCity),
      shipping_address_code: this.optionalTrim(dto.shippingAddressCode),
      quantity,
      unit_price_snapshot: product.price,
      commission_snapshot: product.commission_amount ?? null,
      status,
      source: dto.source,
      shipped_at: shippedAt,
      payment_provider: 'manual',
      tracking_token: this.generateTrackingToken(),
    });

    const saved = await this.ordersRepo.save(order);

    await this.fulfillmentService.decrementStock(saved.product_id, saved.quantity);

    const withRelations = await this.ordersRepo.findOne({
      where: { id: saved.id },
      relations: { clinic: true, product: true },
    });

    if (!withRelations) {
      throw new NotFoundException('Order not found');
    }

    await this.fulfillmentService.recordSaleAndCommission(withRelations);

    return this.toListItem(withRelations);
  }

  async listRecentCountable(limit = 12): Promise<OrderListItem[]> {
    const orders = await this.ordersRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.clinic', 'clinic')
      .leftJoinAndSelect('order.product', 'product')
      .where('order.status IN (:...statuses)', {
        statuses: [
          OrderStatus.PAID,
          OrderStatus.AWAITING_SHIPMENT,
          OrderStatus.SHIPPED,
          OrderStatus.COMPLETED,
        ],
      })
      .orderBy('order.createdAt', 'DESC')
      .take(limit)
      .getMany();

    return orders.map((order) => this.toListItem(order));
  }

  async getById(id: string): Promise<OrderDetail> {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: { clinic: true, product: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.toDetail(order);
  }

  async updateStatus(id: string, dto: UpdateOrderDto): Promise<OrderListItem> {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: { clinic: true, product: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.AWAITING_SHIPMENT) {
      throw new BadRequestException(
        'Only orders awaiting shipment can be updated',
      );
    }

    if (
      dto.status !== OrderStatus.SHIPPED &&
      dto.status !== OrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Invalid status transition');
    }

    order.status = dto.status;
    if (dto.status === OrderStatus.SHIPPED) {
      order.shipped_at = new Date();
    }

    const saved = await this.ordersRepo.save(order);
    return this.toListItem(saved);
  }

  async updateShipping(
    id: string,
    dto: UpdateShippingDto,
  ): Promise<OrderDetail> {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: { clinic: true, product: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status !== OrderStatus.AWAITING_SHIPMENT &&
      order.status !== OrderStatus.SHIPPED
    ) {
      throw new BadRequestException(
        'Only orders awaiting shipment or shipped can be updated',
      );
    }

    const carrier = dto.carrier?.trim() || null;
    const trackingNumber = dto.trackingNumber?.trim() || null;
    const wasAwaitingShipment = order.status === OrderStatus.AWAITING_SHIPMENT;
    const shouldShip = wasAwaitingShipment && !!trackingNumber;

    order.carrier = carrier;
    order.tracking_number = trackingNumber;

    if (shouldShip) {
      order.status = OrderStatus.SHIPPED;
      order.shipped_at = new Date();
    }

    const saved = await this.ordersRepo.save(order);

    if (shouldShip && saved.customer_email) {
      const frontendUrl =
        this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
      const trackingUrl = `${frontendUrl}/track/${saved.tracking_token}`;

      await this.emailService.sendShipmentNotification({
        to: saved.customer_email,
        customerName: saved.customer_name ?? 'Customer',
        orderNo: saved.order_no,
        carrier: saved.carrier ?? '',
        trackingNumber: saved.tracking_number ?? '',
        trackingUrl,
      });
    }

    return this.toDetail(saved);
  }

  private validateManualOrder(dto: CreateManualOrderDto): void {
    if (!dto.productId) {
      throw new BadRequestException('Product is required');
    }

    if (!dto.status || !MANUAL_STATUSES.has(dto.status)) {
      throw new BadRequestException('Invalid order status');
    }

    if (
      !dto.source ||
      !Object.values(OrderSource).includes(dto.source)
    ) {
      throw new BadRequestException('Invalid order source');
    }

    const isMarketplace =
      dto.source === OrderSource.LAZADA || dto.source === OrderSource.SHOPEE;

    if (!isMarketplace) {
      const required = [
        ['customerName', dto.customerName],
        ['customerEmail', dto.customerEmail],
        ['customerPhone', dto.customerPhone],
        ['shippingAddressStreet', dto.shippingAddressStreet],
        ['shippingAddressCity', dto.shippingAddressCity],
        ['shippingAddressCode', dto.shippingAddressCode],
      ] as const;

      for (const [field, value] of required) {
        if (!value?.trim()) {
          throw new BadRequestException(`${field} is required for Wontech orders`);
        }
      }
    }
  }

  private optionalTrim(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private applyLogisticsSort(
    qb: ReturnType<Repository<Order>['createQueryBuilder']>,
    sortBy?: string,
    sortDir?: string,
  ): void {
    const direction = sortDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    switch (sortBy) {
      case 'orderNo':
        qb.orderBy('order.order_no', direction);
        break;
      case 'customer':
        qb.orderBy('LOWER(COALESCE(order.customer_name, \'\'))', direction);
        break;
      case 'item':
        qb.orderBy('LOWER(COALESCE(product.name, \'\'))', direction);
        break;
      case 'qty':
        qb.orderBy('order.quantity', direction);
        break;
      case 'status':
        qb.orderBy('order.status', direction);
        break;
      case 'date':
      default:
        qb.orderBy('order.createdAt', direction);
    }
  }

  private applyOrderSort(
    qb: ReturnType<Repository<Order>['createQueryBuilder']>,
    sortBy?: string,
    sortDir?: string,
  ): void {
    const direction = sortDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    switch (sortBy) {
      case 'orderNo':
        qb.orderBy('order.order_no', direction);
        break;
      case 'customer':
        qb.orderBy('LOWER(COALESCE(order.customer_name, \'\'))', direction);
        break;
      case 'clinic':
        qb.orderBy('LOWER(COALESCE(clinic.name, \'\'))', direction);
        break;
      case 'qty':
        qb.orderBy('order.quantity', direction);
        break;
      case 'status':
        qb.orderBy('order.status', direction);
        break;
      case 'total':
        qb.orderBy(
          '(order.quantity * order.unit_price_snapshot::numeric)',
          direction,
        );
        break;
      case 'date':
      default:
        qb.orderBy('order.createdAt', direction);
    }
  }

  private toListItem(order: Order): OrderListItem {
    const sourceLabel =
      order.source === OrderSource.LAZADA
        ? 'Lazada'
        : order.source === OrderSource.SHOPEE
          ? 'Shopee'
          : null;

    return {
      id: order.id,
      orderNo: order.order_no,
      date: order.createdAt.toISOString(),
      customer: order.customer_name ?? sourceLabel ?? '—',
      clinic: order.clinic?.name ?? '—',
      item: order.product?.name ?? '',
      qty: order.quantity,
      status: order.status,
      total: Number(order.unit_price_snapshot) * order.quantity,
      source: order.source,
    };
  }

  private toLogisticsListItem(order: Order): LogisticsListItem {
    const sourceLabel =
      order.source === OrderSource.LAZADA
        ? 'Lazada'
        : order.source === OrderSource.SHOPEE
          ? 'Shopee'
          : null;

    return {
      id: order.id,
      orderNo: order.order_no,
      date: order.createdAt.toISOString(),
      customer: order.customer_name ?? sourceLabel ?? '—',
      item: order.product?.name ?? '',
      qty: order.quantity,
      status: order.status,
    };
  }

  private toDetail(order: Order): OrderDetail {
    const unitPrice = Number(order.unit_price_snapshot);
    return {
      id: order.id,
      orderNo: order.order_no,
      status: order.status,
      source: order.source,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      productId: order.product_id,
      productName: order.product?.name ?? '',
      productSku: order.product?.sku ?? '',
      quantity: order.quantity,
      unitPrice,
      total: unitPrice * order.quantity,
      clinicId: order.clinic_id ?? null,
      clinicName: order.clinic?.name ?? '—',
      customerName: order.customer_name ?? null,
      customerEmail: order.customer_email ?? null,
      customerPhone: order.customer_phone ?? null,
      shippingAddressStreet: order.shipping_address_street ?? null,
      shippingAddressCity: order.shipping_address_city ?? null,
      shippingAddressCode: order.shipping_address_code ?? null,
      paymentProvider: order.payment_provider ?? null,
      paymentReference: order.payment_reference ?? null,
      trackingToken: order.tracking_token,
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
