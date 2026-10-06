import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { InfluencerCreditLedgerEntry } from '../influencers/influencer-credit-ledger.entity';
import { Influencer } from '../influencers/influencer.entity';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { Agency } from './agency.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agency,
      Influencer,
      InfluencerCreditLedgerEntry,
    ]),
    AuthModule,
  ],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
