import { Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { AdjustCreditDto } from './dto/adjust-credit.dto';

@Controller('clinics')
@UseGuards(FirebaseAuthGuard)
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get('lookup')
  async lookup() {
    return this.clinicsService.listAll();
  }

  @Get()
  async list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.clinicsService.listPaginated(
      search,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
      sortBy,
      sortDir,
    );
  }

  @Get(':id/credit-ledger')
  async getCreditLedger(@Param('id') id: string) {
    return this.clinicsService.getCreditLedger(id);
  }

  @Post(':id/credit-adjustment')
  async adjustCredit(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: AdjustCreditDto,
  ) {
    const { uid } = req['firebaseUser'];
    return this.clinicsService.adjustCredit(id, uid, dto);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const clinic = await this.clinicsService.getById(id);
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }
    return clinic;
  }

  @Post()
  async create(@Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto);
  }
}

