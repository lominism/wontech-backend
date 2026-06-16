import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from './clinic.entity';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicsRepo: Repository<Clinic>,
  ) {}

  async list(): Promise<Clinic[]> {
    return this.clinicsRepo.find({
      order: { createdAt: 'DESC' },
    });
  }
}

