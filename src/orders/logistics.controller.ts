import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { OrdersService } from './orders.service';

@Controller('logistics')
@UseGuards(FirebaseAuthGuard)
export class LogisticsController {
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
    return this.ordersService.listLogistics(
      search,
      status,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
      sortBy,
      sortDir,
    );
  }
}
