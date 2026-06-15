import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOrCreate(firebaseUid: string, email: string, displayName?: string): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { firebaseUid },
    });

    if (existing) {
      return existing;
    }

    const newUser = this.usersRepository.create({
      firebaseUid,
      email,
      displayName: displayName ?? undefined,
    });

    return this.usersRepository.save(newUser) as Promise<User>;
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { firebaseUid } });
  }
}
