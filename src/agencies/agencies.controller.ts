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
import { AgenciesService } from './agencies.service';
import { CreateAgencyDto } from './dto/create-agency.dto';

@Controller('agencies')
@UseGuards(FirebaseAuthGuard)
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get()
  async list() {
    return this.agenciesService.list();
  }

  @Post()
  async create(@Body() dto: CreateAgencyDto) {
    return this.agenciesService.create(dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.agenciesService.delete(id);
    return { success: true };
  }
}
