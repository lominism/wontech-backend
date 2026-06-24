import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';

@Controller('clinics')
@UseGuards(FirebaseAuthGuard)
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  async list() {
    return this.clinicsService.list();
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

