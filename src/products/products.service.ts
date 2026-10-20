import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Order, OrderSource, OrderStatus } from '../orders/order.entity';
import { Sale } from '../sales/sale.entity';
import { UsersService } from '../users/users.service';
import { Product } from './product.entity';
import { InventoryStock } from './stock.entity';
import { InventoryStockLedgerEntry } from './inventory-stock-ledger.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  normalizeImageUrls,
  primaryImageUrl,
} from './product-images.util';

export type ProductWithMeta = Product & { has_orders: boolean };

export type ProductHistoryItem = {
  id: string;
  type: 'sale' | 'adjustment';
  date: string;
  quantity: number;
  customerName: string | null;
  clinicName: string | null;
  actorName: string | null;
  delta: number | null;
};

export type ProductHistoryResult = {
  items: ProductHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(InventoryStock)
    private readonly stockRepo: Repository<InventoryStock>,
    @InjectRepository(InventoryStockLedgerEntry)
    private readonly stockLedgerRepo: Repository<InventoryStockLedgerEntry>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    private readonly usersService: UsersService,
  ) {}

  async list(): Promise<Product[]> {
    const products = await this.productsRepo.find({
      order: { createdAt: 'DESC' },
      relations: { stock: true },
    });
    return products.map((p) => this.normalizeProductImages(p));
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const existing = await this.productsRepo.findOne({
      where: { sku: dto.sku },
    });
    if (existing) {
      throw new ConflictException('SKU already exists');
    }

    const imageUrls = normalizeImageUrls(dto.imageUrls, dto.imageUrl);

    const product = this.productsRepo.create({
      sku: dto.sku,
      name: dto.name,
      category: this.normalizeCategory(dto.category),
      price: String(dto.price),
      commission_amount:
        dto.commission === null || dto.commission === undefined
          ? null
          : String(dto.commission),
      kol_commission_amount:
        dto.kolCommission === null || dto.kolCommission === undefined
          ? null
          : String(dto.kolCommission),
      description: dto.description ?? null,
      brand: dto.brand ?? null,
      weight: dto.weight ?? null,
      dimensions: dto.dimensions ?? null,
      origin_country: dto.originCountry ?? null,
      image_urls: imageUrls,
      image_url: primaryImageUrl(imageUrls),
      is_active: true,
    });

    const saved = await this.productsRepo.save(product);

    const stock = this.stockRepo.create({
      product_id: saved.id,
      quantity_on_hand: Math.max(0, Number(dto.stock ?? 0)),
    });
    await this.stockRepo.save(stock);

    return this.normalizeProductImages(
      await this.productsRepo.findOneOrFail({
        where: { id: saved.id },
        relations: { stock: true },
      }),
    );
  }

  async getById(id: string): Promise<Product | null> {
    const product = await this.productsRepo.findOne({
      where: { id },
      relations: { stock: true },
    });
    return product ? this.normalizeProductImages(product) : null;
  }

  async getByIdWithMeta(id: string): Promise<ProductWithMeta | null> {
    const product = await this.getById(id);
    if (!product) return null;

    const has_orders = await this.hasOrders(id);
    return Object.assign(product, { has_orders });
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    firebaseUid?: string,
  ): Promise<Product> {
    const product = await this.getById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const skuConflict = await this.productsRepo.findOne({
      where: { sku: dto.sku },
    });
    if (skuConflict && skuConflict.id !== id) {
      throw new ConflictException('SKU already exists');
    }

    product.sku = dto.sku;
    product.name = dto.name;
    product.category = this.normalizeCategory(dto.category);
    product.price = String(dto.price);
    product.commission_amount =
      dto.commission === null || dto.commission === undefined
        ? null
        : String(dto.commission);
    product.kol_commission_amount =
      dto.kolCommission === null || dto.kolCommission === undefined
        ? null
        : String(dto.kolCommission);
    product.description = dto.description ?? null;
    product.brand = dto.brand ?? null;
    product.weight = dto.weight ?? null;
    product.dimensions = dto.dimensions ?? null;
    product.origin_country = dto.originCountry ?? null;
    const imageUrls = normalizeImageUrls(dto.imageUrls, dto.imageUrl);
    product.image_urls = imageUrls;
    product.image_url = primaryImageUrl(imageUrls);
    if (dto.isActive !== undefined) {
      product.is_active = dto.isActive;
    }

    await this.productsRepo.save(product);

    const stock = await this.stockRepo.findOne({
      where: { product_id: id },
    });
    if (stock) {
      const quantityBefore = stock.quantity_on_hand;
      const quantityAfter = Math.max(0, Number(dto.stock ?? 0));
      const delta = quantityAfter - quantityBefore;

      stock.quantity_on_hand = quantityAfter;
      await this.stockRepo.save(stock);

      if (delta !== 0) {
        await this.recordStockAdjustment({
          productId: id,
          delta,
          quantityBefore,
          quantityAfter,
          firebaseUid,
        });
      }
    }

    return this.normalizeProductImages(
      await this.productsRepo.findOneOrFail({
        where: { id },
        relations: { stock: true },
      }),
    );
  }

  async listHistory(
    productId: string,
    page = 1,
    pageSize = 10,
  ): Promise<ProductHistoryResult> {
    const product = await this.getById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 10));

    const [orders, adjustments] = await Promise.all([
      this.ordersRepo.find({
        where: {
          product_id: productId,
          status: Not(
            In([OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED]),
          ),
        },
        relations: { clinic: true, influencer: true },
        order: { createdAt: 'DESC' },
      }),
      this.stockLedgerRepo.find({
        where: { product_id: productId },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const saleItems: ProductHistoryItem[] = orders.map((order) => ({
      id: order.id,
      type: 'sale',
      date: order.createdAt.toISOString(),
      quantity: order.quantity,
      customerName: this.saleCustomerName(order),
      clinicName: this.saleClinicName(order),
      actorName: null,
      delta: null,
    }));

    const adjustmentItems: ProductHistoryItem[] = adjustments.map((entry) => ({
      id: entry.id,
      type: 'adjustment',
      date: entry.createdAt.toISOString(),
      quantity: Math.abs(entry.delta),
      customerName: null,
      clinicName: 'Wontech Admin',
      actorName: entry.performed_by_name?.trim() || 'System',
      delta: entry.delta,
    }));

    const merged = [...saleItems, ...adjustmentItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const total = merged.length;
    const start = (safePage - 1) * safePageSize;

    return {
      items: merged.slice(start, start + safePageSize),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async delete(id: string): Promise<void> {
    const product = await this.getById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (await this.hasOrders(id)) {
      throw new ConflictException(
        'Product has orders and cannot be deleted',
      );
    }

    await this.stockLedgerRepo.delete({ product_id: id });
    await this.stockRepo.delete({ product_id: id });
    await this.productsRepo.delete({ id });
  }

  async hasOrders(id: string): Promise<boolean> {
    const [orderCount, saleCount] = await Promise.all([
      this.ordersRepo.count({ where: { product_id: id } }),
      this.salesRepo.count({ where: { product_id: id } }),
    ]);
    return orderCount > 0 || saleCount > 0;
  }

  private async recordStockAdjustment(params: {
    productId: string;
    delta: number;
    quantityBefore: number;
    quantityAfter: number;
    firebaseUid?: string;
  }): Promise<void> {
    let performedByUserId: string | null = null;
    let performedByName = 'System';

    if (params.firebaseUid) {
      const user = await this.usersService.findByFirebaseUid(
        params.firebaseUid,
      );
      if (user) {
        performedByUserId = user.id;
        performedByName = this.backofficeUserName(user);
      }
    }

    const entry = this.stockLedgerRepo.create({
      product_id: params.productId,
      delta: params.delta,
      quantity_before: params.quantityBefore,
      quantity_after: params.quantityAfter,
      performed_by_backoffice_user_id: performedByUserId,
      performed_by_name: performedByName,
    });
    await this.stockLedgerRepo.save(entry);
  }

  private saleCustomerName(order: Order): string | null {
    if (order.customer_name?.trim()) return order.customer_name.trim();
    if (order.source === OrderSource.LAZADA) return 'Lazada';
    if (order.source === OrderSource.SHOPEE) return 'Shopee';
    return null;
  }

  private saleClinicName(order: Order): string | null {
    if (order.influencer?.name?.trim()) return order.influencer.name.trim();
    if (order.clinic?.name?.trim()) return order.clinic.name.trim();
    if (order.source === OrderSource.STOREFRONT) return 'Storefront';
    return null;
  }

  private backofficeUserName(user: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  }): string {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : user.email;
  }

  private normalizeCategory(category?: string | null): string | null {
    if (category == null) return null;
    const trimmed = category.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeProductImages(product: Product): Product {
    const image_urls = normalizeImageUrls(product.image_urls, product.image_url);
    product.image_urls = image_urls;
    product.image_url = primaryImageUrl(image_urls);
    return product;
  }
}
