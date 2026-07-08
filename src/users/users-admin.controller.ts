import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { User, UserRole } from './user.entity';
import { CreateUserInvitationDto } from './dto/create-user-invitation.dto';

@Controller('users')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listMembers() {
    return this.usersService.listMembers();
  }

  @Get('invitations')
  async listInvitations() {
    return this.usersService.listInvitations();
  }

  @Post('invitations')
  async createInvitation(
    @Req() req: Request,
    @Body() dto: CreateUserInvitationDto,
  ) {
    const requester = req['dbUser'] as User;
    return this.usersService.createInvitation(dto.email, requester);
  }

  @Delete('invitations/:id')
  async revokeInvitation(@Param('id') id: string) {
    await this.usersService.revokeInvitation(id);
    return { success: true };
  }

  @Delete(':id')
  async removeMember(@Req() req: Request, @Param('id') id: string) {
    const requester = req['dbUser'] as User;
    await this.usersService.removeMember(id, requester);
    return { success: true };
  }
}
