import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async findOrCreate(
    firebaseUid: string,
    email: string,
    firstName?: string,
    lastName?: string,
  ): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { firebaseUid },
    });

    if (existing) {
      return this.backfillNames(existing, firstName, lastName);
    }

    const superAdminEmail = this.config.get<string>('SUPER_ADMIN_EMAIL');
    const usersCount = await this.usersRepository.count();

    const newUser = this.usersRepository.create({
      firebaseUid,
      email,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      role:
        (superAdminEmail && email === superAdminEmail) || usersCount === 0
          ? UserRole.SUPER_ADMIN
          : UserRole.USER,
    });

    try {
      return await this.usersRepository.save(newUser);
    } catch (error) {
      // Two sync requests can race (register handler + auth-state listener),
      // both inserting the same firebaseUid. The losing INSERT hits a unique
      // violation; recover by loading the row the other request created.
      if (this.isUniqueViolation(error)) {
        const row = await this.usersRepository.findOne({
          where: { firebaseUid },
        });
        if (row) {
          return this.backfillNames(row, firstName, lastName);
        }
      }
      throw error;
    }
  }

  // Backfill names if the row was created without them (e.g. an earlier
  // auth-state sync ran before the register form values were available).
  private async backfillNames(
    user: User,
    firstName?: string,
    lastName?: string,
  ): Promise<User> {
    let changed = false;
    if (!user.firstName && firstName) {
      user.firstName = firstName;
      changed = true;
    }
    if (!user.lastName && lastName) {
      user.lastName = lastName;
      changed = true;
    }
    return changed ? this.usersRepository.save(user) : user;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { firebaseUid } });
  }
}
