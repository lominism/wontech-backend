import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { InventoryStock } from './stock.entity';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(InventoryStock)
    private readonly stockRepo: Repository<InventoryStock>,
  ) {}

  async list(): Promise<Product[]> {
    return this.productsRepo.find({
      order: { createdAt: 'DESC' },
      relations: { stock: true },
    });
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const existing = await this.productsRepo.findOne({
      where: { sku: dto.sku },
    });
    if (existing) {
      throw new ConflictException('SKU already exists');
    }

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
      image_url: dto.imageUrl ?? null,
    });

    const saved = await this.productsRepo.save(product);

    const stock = this.stockRepo.create({
      product_id: saved.id,
      quantity_on_hand: Math.max(0, Number(dto.stock ?? 0)),
    });
    await this.stockRepo.save(stock);

    return this.productsRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { stock: true },
    });
  }

  async getById(id: string): Promise<Product | null> {
    return this.productsRepo.findOne({ where: { id }, relations: { stock: true } });
  }
}

