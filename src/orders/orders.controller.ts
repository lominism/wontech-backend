import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(FirebaseAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.ordersService.list(
      search,
      status,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
      sortBy,
      sortDir,
    );
  }

  @Post()
  async create(@Body() dto: CreateManualOrderDto) {
    return this.ordersService.createManual(dto);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.ordersService.getById(id);
  }

  @Patch(':id/shipping')
  async updateShipping(
    @Param('id') id: string,
    @Body() dto: UpdateShippingDto,
  ) {
    return this.ordersService.updateShipping(id, dto);
  }

  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.updateStatus(id, dto);
  }
}
