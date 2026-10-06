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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import { AdjustInfluencerCreditDto } from './dto/adjust-credit.dto';
import { CreateInfluencerDto } from './dto/create-influencer.dto';
import { UpdateInfluencerDto } from './dto/update-influencer.dto';
import { InfluencersService } from './influencers.service';

@Controller('influencers')
@UseGuards(FirebaseAuthGuard)
export class InfluencersController {
  constructor(private readonly influencersService: InfluencersService) {}

  @Get('lookup')
  async lookup() {
    return this.influencersService.listAll();
  }

  @Get()
  async list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.influencersService.listPaginated(
      search,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
      sortBy,
      sortDir,
    );
  }

  @Get(':id/credit-ledger')
  async getCreditLedger(@Param('id') id: string) {
    return this.influencersService.getCreditLedger(id);
  }

  @Post(':id/credit-adjustment')
  async adjustCredit(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: AdjustInfluencerCreditDto,
  ) {
    const { uid } = req['firebaseUser'];
    return this.influencersService.adjustCredit(id, uid, dto);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const influencer = await this.influencersService.getById(id);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }
    return influencer;
  }

  @Post()
  async create(@Body() dto: CreateInfluencerDto) {
    return this.influencersService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateInfluencerDto) {
    return this.influencersService.updateContact(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  async remove(@Param('id') id: string) {
    await this.influencersService.deleteInfluencer(id);
    return { success: true };
  }
}
