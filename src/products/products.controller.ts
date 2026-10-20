import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
@UseGuards(FirebaseAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list() {
    return this.productsService.list();
  }

  @Get(':id/history')
  async history(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.productsService.listHistory(
      id,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
    );
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const product = await this.productsService.getByIdWithMeta(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ) {
    const { uid } = req['firebaseUser'];
    return this.productsService.update(id, dto, uid);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.productsService.delete(id);
    return { success: true };
  }
}
