import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { ProductCategoriesService } from './product-categories.service';

@Controller('product-categories')
@UseGuards(FirebaseAuthGuard)
export class ProductCategoriesController {
  constructor(
    private readonly productCategoriesService: ProductCategoriesService,
  ) {}

  @Get()
  async list() {
    return this.productCategoriesService.list();
  }

  @Post()
  async create(@Body() dto: CreateProductCategoryDto) {
    return this.productCategoriesService.create(dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.productCategoriesService.delete(id);
    return { success: true };
  }
}
