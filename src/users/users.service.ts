import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { PreferredLocale, User, UserRole } from './user.entity';
import { InvitationStatus, UserInvitation } from './user-invitation.entity';
import { ClinicGroupCreditLedgerEntry } from '../clinics/clinic-group-credit-ledger.entity';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserInvitation)
    private invitationsRepository: Repository<UserInvitation>,
    private readonly config: ConfigService,
    private readonly firebaseAdmin: FirebaseAdminService,
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

    const normalizedEmail = email.trim().toLowerCase();
    const ownerEmail = this.config
      .get<string>('OWNER_EMAIL')
      ?.trim()
      .toLowerCase();
    const ownersCount = await this.usersRepository.count({
      where: { role: UserRole.OWNER },
    });

    const isOwner =
      ownersCount === 0 && (!ownerEmail || normalizedEmail === ownerEmail);

    // Non-owner sign-ups are invite-only. Reject anyone without a valid,
    // pending invitation for their email.
    let matchingInvite: UserInvitation | null = null;
    if (!isOwner) {
      matchingInvite = await this.findRedeemableInvitation(normalizedEmail);
      if (!matchingInvite) {
        throw new ForbiddenException(
          'No invitation found for this email. Please ask the owner to invite you.',
        );
      }
    }

    const newUser = this.usersRepository.create({
      firebaseUid,
      email,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      role: isOwner ? UserRole.OWNER : (matchingInvite?.role ?? UserRole.ADMIN),
    });

    let savedUser: User;
    try {
      savedUser = await this.usersRepository.save(newUser);
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

    if (matchingInvite) {
      matchingInvite.accepted_at = new Date();
      await this.invitationsRepository.save(matchingInvite);
    }

    return savedUser;
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

  async updateProfile(
    firebaseUid: string,
    data: {
      firstName: string;
      lastName: string;
      avatarUrl?: string | null;
      preferredLocale?: string;
    },
  ): Promise<User> {
    const user = await this.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const firstName = data.firstName?.trim() ?? '';
    const lastName = data.lastName?.trim() ?? '';
    if (!firstName || !lastName) {
      throw new BadRequestException('First name and last name are required');
    }

    user.firstName = firstName;
    user.lastName = lastName;
    if (data.avatarUrl !== undefined) {
      const url = data.avatarUrl?.trim() || null;
      user.avatarUrl = url;
    }
    if (data.preferredLocale !== undefined) {
      user.preferredLocale = this.parsePreferredLocale(data.preferredLocale);
    }

    return this.usersRepository.save(user);
  }

  private parsePreferredLocale(value: string): PreferredLocale {
    const locale = value?.trim().toLowerCase();
    if (locale === PreferredLocale.EN || locale === PreferredLocale.TH) {
      return locale;
    }
    throw new BadRequestException('Preferred locale must be en or th');
  }

  // ─── Member management (owner-only) ────────────────────────────────────────

  async listMembers(): Promise<User[]> {
    return this.usersRepository.find({
      order: { createdAt: 'ASC' },
    });
  }

  async removeMember(targetUserId: string, requester: User): Promise<void> {
    const target = await this.usersRepository.findOne({
      where: { id: targetUserId },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('The owner cannot be removed');
    }
    if (target.id === requester.id) {
      throw new ForbiddenException('You cannot remove yourself');
    }

    const displayName =
      [target.firstName, target.lastName].filter(Boolean).join(' ') ||
      target.email;

    // Hard delete. Members carry no data of their own except their name in the
    // credit ledger, so we denormalize that name onto the affected ledger rows
    // and drop the FK before deleting the user, preserving credit history.
    await this.usersRepository.manager.transaction(async (manager) => {
      await manager.update(
        ClinicGroupCreditLedgerEntry,
        { performed_by_backoffice_user_id: target.id },
        {
          performed_by_name: displayName,
          performed_by_backoffice_user_id: null,
        },
      );
      await manager.delete(User, target.id);
    });

    // Best-effort: remove the Firebase auth account too so the person is fully
    // removed and their email is freed for a clean re-invite. Runs after the DB
    // commit; a missing account (already deleted) is not an error.
    try {
      await this.firebaseAdmin.auth.deleteUser(target.firebaseUid);
    } catch {
      // Ignore: the app-side removal already succeeded.
    }
  }

  // ─── Invitations (owner-only) ──────────────────────────────────────────────

  private async findRedeemableInvitation(
    normalizedEmail: string,
  ): Promise<UserInvitation | null> {
    const invites = await this.invitationsRepository.find({
      where: {
        email: normalizedEmail,
        accepted_at: IsNull(),
        revoked_at: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    const now = Date.now();
    return (
      invites.find((invite) => invite.expires_at.getTime() > now) ?? null
    );
  }

  async listInvitations(): Promise<
    (UserInvitation & { status: InvitationStatus })[]
  > {
    const invites = await this.invitationsRepository.find({
      relations: { invitedByUser: true },
      order: { createdAt: 'DESC' },
    });

    return invites.map((invite) => ({
      ...invite,
      status: this.resolveStatus(invite),
    }));
  }

  private resolveStatus(invite: UserInvitation): InvitationStatus {
    if (invite.accepted_at) return InvitationStatus.ACCEPTED;
    if (invite.revoked_at) return InvitationStatus.REVOKED;
    if (invite.expires_at.getTime() <= Date.now()) {
      return InvitationStatus.EXPIRED;
    }
    return InvitationStatus.PENDING;
  }

  async createInvitation(
    email: string,
    invitedBy: User,
  ): Promise<UserInvitation & { status: InvitationStatus }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new ForbiddenException('A valid email is required');
    }

    const existingUser = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ForbiddenException('This user is already a member');
    }

    const existingInvite = await this.findRedeemableInvitation(normalizedEmail);
    if (existingInvite) {
      throw new ForbiddenException(
        'A pending invitation already exists for this email',
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

    const rawToken = randomBytes(24).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const invitation = this.invitationsRepository.create({
      email: normalizedEmail,
      role: UserRole.ADMIN,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by_user_id: invitedBy.id,
    });

    const saved = await this.invitationsRepository.save(invitation);
    const withRelation = await this.invitationsRepository.findOne({
      where: { id: saved.id },
      relations: { invitedByUser: true },
    });

    return {
      ...(withRelation ?? saved),
      status: InvitationStatus.PENDING,
    };
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.accepted_at) {
      throw new ForbiddenException('Accepted invitations cannot be revoked');
    }

    invitation.revoked_at = new Date();
    await this.invitationsRepository.save(invitation);
  }
}
