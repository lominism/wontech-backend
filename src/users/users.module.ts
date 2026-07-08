import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserInvitation } from './user-invitation.entity';
import { UsersController } from './users.controller';
import { UsersAdminController } from './users-admin.controller';
import { UsersService } from './users.service';
import { RolesGuard } from '../auth/roles.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserInvitation]),
    AuthModule,
  ],
  controllers: [UsersController, UsersAdminController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService],
})
export class UsersModule {}
