import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import {
  ClinicMode,
  DashboardRange,
  DashboardService,
} from './dashboard.service';

@Controller('dashboard')
@UseGuards(FirebaseAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getStats(
    @Query('revenueRange') revenueRange?: string,
    @Query('ordersRange') ordersRange?: string,
    @Query('clinicMode') clinicMode?: string,
  ) {
    return this.dashboardService.getStats(
      this.parseRange(revenueRange),
      this.parseRange(ordersRange),
      this.parseClinicMode(clinicMode),
    );
  }

  private parseRange(value?: string): DashboardRange {
    if (value === 'last3Months' || value === 'lastWeek') {
      return value;
    }
    return 'lastYear';
  }

  private parseClinicMode(value?: string): ClinicMode {
    return value === 'active' ? 'active' : 'total';
  }
}
