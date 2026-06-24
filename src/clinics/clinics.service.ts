import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from './clinic.entity';
import { ClinicGroup } from './clinic-group.entity';
import { CreateClinicDto } from './dto/create-clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicsRepo: Repository<Clinic>,
    @InjectRepository(ClinicGroup)
    private readonly groupsRepo: Repository<ClinicGroup>,
  ) {}

  async list(): Promise<Clinic[]> {
    return this.clinicsRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getById(id: string): Promise<Clinic | null> {
    return this.clinicsRepo.findOne({ where: { id } });
  }

  async create(dto: CreateClinicDto): Promise<Clinic> {
    const name = dto.name?.trim();
    const addressStreet = dto.addressStreet?.trim();
    const addressCity = dto.addressCity?.trim();
    const addressCode = dto.addressCode?.trim();
    const contactEmail = dto.contactEmail?.trim();
    const parentClinicId = dto.parentClinicId?.trim() || null;
    const newParentName = dto.newParentName?.trim() || null;

    if (!name || !addressStreet || !addressCity || !addressCode || !contactEmail) {
      throw new BadRequestException(
        'Name, address, and contact email are required',
      );
    }

    if (parentClinicId && newParentName) {
      throw new BadRequestException(
        'Specify either an existing parent clinic or a new parent name, not both',
      );
    }

    const addressFields = {
      address_street: addressStreet,
      address_city: addressCity,
      address_code: addressCode,
    };

    if (parentClinicId) {
      const parent = await this.clinicsRepo.findOne({
        where: { id: parentClinicId },
      });
      if (!parent) {
        throw new NotFoundException('Parent clinic not found');
      }

      const clinic = this.clinicsRepo.create({
        name,
        ...addressFields,
        contact_email: contactEmail,
        group_id: parent.group_id,
        parent_clinic_id: parent.id,
      });
      return this.clinicsRepo.save(clinic);
    }

    if (newParentName) {
      const group = this.groupsRepo.create({ name: newParentName });
      const savedGroup = await this.groupsRepo.save(group);

      const parent = this.clinicsRepo.create({
        name: newParentName,
        address_street: '—',
        address_city: '—',
        address_code: '—',
        contact_email: contactEmail,
        group_id: savedGroup.id,
        parent_clinic_id: null,
      });
      const savedParent = await this.clinicsRepo.save(parent);

      const clinic = this.clinicsRepo.create({
        name,
        ...addressFields,
        contact_email: contactEmail,
        group_id: savedGroup.id,
        parent_clinic_id: savedParent.id,
      });
      return this.clinicsRepo.save(clinic);
    }

    const group = this.groupsRepo.create({ name });
    const savedGroup = await this.groupsRepo.save(group);

    const clinic = this.clinicsRepo.create({
      name,
      ...addressFields,
      contact_email: contactEmail,
      group_id: savedGroup.id,
      parent_clinic_id: null,
    });
    return this.clinicsRepo.save(clinic);
  }
}
