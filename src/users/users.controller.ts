import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UsersService } from './users.service';

@Controller('auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  @UseGuards(FirebaseAuthGuard)
  async sync(@Req() req: Request) {
    const { uid, email, name } = req['firebaseUser'];
    const user = await this.usersService.findOrCreate(uid, email, name);
    return user;
  }
}
