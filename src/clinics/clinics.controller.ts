import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ClinicsService } from './clinics.service';

@Controller('clinics')
@UseGuards(FirebaseAuthGuard)
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  async list() {
    return this.clinicsService.list();
  }
}

