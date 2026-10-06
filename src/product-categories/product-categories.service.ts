import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { ProductCategory } from './product-category.entity';

const DEFAULT_CATEGORIES = [
  'Skincare',
  'Devices',
  'Consumables',
  'Supplements',
] as const;

@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoriesRepo: Repository<ProductCategory>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
  ) {}

  async list(): Promise<ProductCategory[]> {
    await this.ensureDefaults();
    return this.categoriesRepo.find({
      order: { name: 'ASC' },
    });
  }

  async create(dto: CreateProductCategoryDto): Promise<ProductCategory> {
    const name = dto.name?.trim() ?? '';
    if (!name) {
      throw new BadRequestException('Category name is required');
    }

    const existing = await this.categoriesRepo.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException('Category already exists');
    }

    const category = this.categoriesRepo.create({ name });
    return this.categoriesRepo.save(category);
  }

  async delete(id: string): Promise<void> {
    const category = await this.categoriesRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.productsRepo.update(
      { category: category.name },
      { category: null },
    );
    await this.categoriesRepo.remove(category);
  }

  private async ensureDefaults(): Promise<void> {
    const count = await this.categoriesRepo.count();
    if (count > 0) return;

    await this.categoriesRepo.save(
      DEFAULT_CATEGORIES.map((name) => this.categoriesRepo.create({ name })),
    );
  }
}
