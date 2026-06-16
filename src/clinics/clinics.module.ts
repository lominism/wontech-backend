import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Clinic } from './clinic.entity';
import { ClinicGroup } from './clinic-group.entity';
import { ClinicInvite } from './clinic-invite.entity';
import { ClinicUser } from './clinic-user.entity';
import { ClinicGroupCreditLedgerEntry } from './clinic-group-credit-ledger.entity';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Clinic,
      ClinicGroup,
      ClinicInvite,
      ClinicUser,
      ClinicGroupCreditLedgerEntry,
    ]),
    AuthModule,
  ],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}

