import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { Sale } from '../sales/sale.entity';
import { Product } from './product.entity';
import { InventoryStock } from './stock.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  normalizeImageUrls,
  primaryImageUrl,
} from './product-images.util';

export type ProductWithMeta = Product & { has_orders: boolean };

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(InventoryStock)
    private readonly stockRepo: Repository<InventoryStock>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
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
      category: dto.category,
      price: String(dto.price),
      commission_amount:
        dto.commission === null || dto.commission === undefined
          ? null
          : String(dto.commission),
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

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
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
    product.category = dto.category;
    product.price = String(dto.price);
    product.commission_amount =
      dto.commission === null || dto.commission === undefined
        ? null
        : String(dto.commission);
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
      stock.quantity_on_hand = Math.max(0, Number(dto.stock ?? 0));
      await this.stockRepo.save(stock);
    }

    return this.normalizeProductImages(
      await this.productsRepo.findOneOrFail({
        where: { id },
        relations: { stock: true },
      }),
    );
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

  private normalizeProductImages(product: Product): Product {
    const image_urls = normalizeImageUrls(product.image_urls, product.image_url);
    product.image_urls = image_urls;
    product.image_url = primaryImageUrl(image_urls);
    return product;
  }
}
