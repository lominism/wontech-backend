import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenciesModule } from '../agencies/agencies.module';
import { Agency } from '../agencies/agency.entity';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { Sale } from '../sales/sale.entity';
import { UsersModule } from '../users/users.module';
import { InfluencerCreditLedgerEntry } from './influencer-credit-ledger.entity';
import { Influencer } from './influencer.entity';
import { InfluencersController } from './influencers.controller';
import { InfluencersService } from './influencers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Influencer,
      Agency,
      InfluencerCreditLedgerEntry,
      Sale,
    ]),
    AuthModule,
    UsersModule,
    AgenciesModule,
  ],
  controllers: [InfluencersController],
  providers: [InfluencersService, RolesGuard],
  exports: [InfluencersService],
})
export class InfluencersModule {}
