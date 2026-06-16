import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UsersService } from './users.service';
import { SyncUserDto } from './dto/sync-user.dto';

@Controller('auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  @UseGuards(FirebaseAuthGuard)
  async sync(@Req() req: Request, @Body() body: SyncUserDto) {
    const { uid, email, name } = req['firebaseUser'];

    // Prefer the explicit names sent from the register form. Fall back to
    // splitting the Firebase display name (e.g. for the self-healing sync).
    let firstName = body?.firstName?.trim() || undefined;
    let lastName = body?.lastName?.trim() || undefined;

    if (!firstName && !lastName && typeof name === 'string' && name.trim()) {
      const [first = '', ...rest] = name.trim().split(/\s+/);
      firstName = first || undefined;
      lastName = rest.join(' ') || undefined;
    }

    const user = await this.usersService.findOrCreate(
      uid,
      email,
      firstName,
      lastName,
    );
    return user;
  }
}
