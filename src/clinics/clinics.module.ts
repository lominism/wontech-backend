import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { Sale } from '../sales/sale.entity';
import { Clinic } from './clinic.entity';
import { ClinicGroup } from './clinic-group.entity';
import { ClinicUser } from './clinic-user.entity';
import { ClinicGroupCreditLedgerEntry } from './clinic-group-credit-ledger.entity';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Clinic,
      ClinicGroup,
      ClinicUser,
      ClinicGroupCreditLedgerEntry,
      Sale,
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ClinicsController],
  providers: [ClinicsService, RolesGuard],
  exports: [ClinicsService],
})
export class ClinicsModule {}

