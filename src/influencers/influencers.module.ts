import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { Sale } from '../sales/sale.entity';
import { UsersModule } from '../users/users.module';
import { InfluencerGroupCreditLedgerEntry } from './influencer-group-credit-ledger.entity';
import { InfluencerGroup } from './influencer-group.entity';
import { Influencer } from './influencer.entity';
import { InfluencersController } from './influencers.controller';
import { InfluencersService } from './influencers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Influencer,
      InfluencerGroup,
      InfluencerGroupCreditLedgerEntry,
      Sale,
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [InfluencersController],
  providers: [InfluencersService, RolesGuard],
  exports: [InfluencersService],
})
export class InfluencersModule {}
