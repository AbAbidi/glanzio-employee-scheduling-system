import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { UserRole, UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import type { AcceptInvitationDto } from './dto/accept-invitation.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';

const ACCESS_TOKEN_FIELDS = {
  id: true,
  email: true,
  role: true,
  status: true,
  authVersion: true,
  employee: {
    select: {
      id: true,
      loginCode: true,
      firstName: true,
      lastName: true,
      isStudent: true,
      active: true,
    },
  },
} as const;

type SessionUser = {
  id: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  authVersion?: number;
  employee: {
    id: string;
    loginCode?: string;
    firstName: string;
    lastName: string;
    isStudent: boolean;
    active: boolean;
  } | null;
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresAt: Date;
};

export type AuthenticationResult = TokenPair & {
  user: SessionUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(input: LoginDto): Promise<AuthenticationResult> {
    if (
      (!input.identifier && !input.email) ||
      (input.identifier && input.email)
    ) {
      throw new BadRequestException('Provide one login identifier.');
    }
    const identifier = (input.identifier ?? input.email ?? '').trim();
    const select = {
      ...ACCESS_TOKEN_FIELDS,
      passwordHash: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    } as const;
    const user = /^[A-Z]{3}[0-9]{3}$/i.test(identifier)
      ? await this.prisma.user.findFirst({
          where: {
            role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] },
            employee: { loginCode: identifier.toUpperCase() },
          },
          select,
        })
      : await this.prisma.user.findFirst({
          // Email is an ADMIN login only, including the legacy `email` contract.
          where: { email: identifier.toLowerCase(), role: UserRole.ADMIN },
          select,
        });

    if (!user) {
      throw new UnauthorizedException('Invalid identifier or password.');
    }

    if (user.status === UserStatus.INVITED) {
      throw new ForbiddenException(
        'Accept your employee invitation before signing in.',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        'Your account has been disabled. Please contact the administrator.',
      );
    }

    if (!user.passwordHash) {
      throw new ForbiddenException(
        'This account does not have an active password.',
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        'Too many failed attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Invalid identifier or password.');
    }

    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
      },
    });

    const tokens = await this.createSession(user);

    return {
      ...tokens,
      user: this.toSessionUser(user),
    };
  }

  async refresh(refreshToken: string): Promise<AuthenticationResult> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: ACCESS_TOKEN_FIELDS,
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('The refresh session is invalid.');
    }

    if (session.revokedAt) {
      await this.prisma.refreshSession.updateMany({
        where: {
          familyId: session.familyId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Refresh-token reuse was detected. Please log in again.',
      );
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('The refresh session has expired.');
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('This account is not active.');
    }

    const nextRefreshToken = randomBytes(48).toString('base64url');
    const nextRefreshTokenHash = this.hashToken(nextRefreshToken);
    const nextExpiry = this.refreshExpiry();
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          lastUsedAt: now,
        },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException(
          'This refresh session was already used.',
        );
      }

      const replacement = await transaction.refreshSession.create({
        data: {
          userId: session.userId,
          tokenHash: nextRefreshTokenHash,
          familyId: session.familyId,
          expiresAt: nextExpiry,
        },
      });

      await transaction.refreshSession.update({
        where: { id: session.id },
        data: { replacedById: replacement.id },
      });
    });

    return {
      accessToken: await this.signAccessToken(session.user),
      refreshToken: nextRefreshToken,
      accessTokenExpiresIn: this.accessTokenExpiresIn(),
      refreshTokenExpiresAt: nextExpiry,
      user: this.toSessionUser(session.user),
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    await this.prisma.refreshSession.updateMany({
      where: {
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async acceptInvitation(
    input: AcceptInvitationDto,
  ): Promise<AuthenticationResult> {
    const invitation = await this.prisma.accountInvitation.findUnique({
      where: { tokenHash: this.hashToken(input.token) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        user: {
          select: ACCESS_TOKEN_FIELDS,
        },
      },
    });
    const now = new Date();

    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= now
    ) {
      throw new UnauthorizedException(
        'The employee invitation is invalid or expired.',
      );
    }

    if (invitation.user.status !== UserStatus.INVITED) {
      throw new ForbiddenException('This invitation can no longer be used.');
    }

    const passwordHash = await argon2.hash(input.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.$transaction(async (transaction) => {
      const accepted = await transaction.accountInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { acceptedAt: now },
      });

      if (accepted.count !== 1) {
        throw new UnauthorizedException(
          'The employee invitation was already used or expired.',
        );
      }

      await transaction.user.update({
        where: { id: invitation.userId },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await transaction.accountInvitation.updateMany({
        where: {
          userId: invitation.userId,
          id: { not: invitation.id },
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: invitation.userId,
          action: 'EMPLOYEE_INVITATION_ACCEPTED',
          entityType: 'User',
          entityId: invitation.userId,
        },
      });
    });

    const activatedUser: SessionUser = {
      ...invitation.user,
      status: UserStatus.ACTIVE,
    };
    const tokens = await this.createSession(activatedUser);

    return {
      ...tokens,
      user: this.toSessionUser(activatedUser),
    };
  }

  async changePassword(
    authenticatedUser: AuthenticatedUser,
    input: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: authenticatedUser.id },
      select: { passwordHash: true },
    });

    if (!user.passwordHash) {
      throw new ForbiddenException(
        'This account does not have an active password.',
      );
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      input.currentPassword,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('The current password is incorrect.');
    }

    const passwordHash = await argon2.hash(input.newPassword, {
      type: argon2.argon2id,
    });
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: authenticatedUser.id },
        data: {
          passwordHash,
          passwordChangedAt: now,
        },
      }),
      this.prisma.refreshSession.updateMany({
        where: {
          userId: authenticatedUser.id,
          revokedAt: null,
        },
        data: { revokedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: authenticatedUser.id,
          action: 'PASSWORD_CHANGED',
          entityType: 'User',
          entityId: authenticatedUser.id,
        },
      }),
    ]);
  }

  async requestPasswordReset(
    email: string,
  ): Promise<{ message: string; developmentResetToken?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    const response = {
      message:
        'If an active account exists for that email, a reset request was created.',
    };

    if (!user || user.status !== UserStatus.ACTIVE) {
      return response;
    }

    const resetToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      return {
        ...response,
        developmentResetToken: resetToken,
      };
    }

    return response;
  }

  async resetPassword(input: ResetPasswordDto): Promise<void> {
    const tokenHash = this.hashToken(input.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException(
        'The password-reset token is invalid or expired.',
      );
    }

    const passwordHash = await argon2.hash(input.newPassword, {
      type: argon2.argon2id,
    });
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException(
          'The password-reset token was already used or expired.',
        );
      }

      await transaction.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      // A successful reset also invalidates other outstanding reset links.
      await transaction.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt: now },
      });
      await transaction.refreshSession.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: resetToken.userId,
          action: 'PASSWORD_RESET',
          entityType: 'User',
          entityId: resetToken.userId,
        },
      });
    });
  }

  private async createSession(user: {
    id: string;
    email: string | null;
    role: UserRole;
    authVersion?: number;
  }): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenExpiresAt = this.refreshExpiry();

    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        familyId: randomUUID(),
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken,
      accessTokenExpiresIn: this.accessTokenExpiresIn(),
      refreshTokenExpiresAt,
    };
  }

  private async signAccessToken(user: {
    id: string;
    email: string | null;
    role: UserRole;
    authVersion?: number;
  }): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        ver: user.authVersion ?? 0,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.accessTokenExpiresIn() as JwtSignOptions['expiresIn'],
      },
    );
  }

  private async recordFailedLogin(
    userId: string,
    previousAttempts: number,
  ): Promise<void> {
    const maximumAttempts = this.configService.get<number>(
      'AUTH_MAX_FAILED_ATTEMPTS',
      5,
    );
    const lockMinutes = this.configService.get<number>('AUTH_LOCK_MINUTES', 15);
    const nextAttempts = previousAttempts + 1;
    const shouldLock = nextAttempts >= maximumAttempts;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: shouldLock ? 0 : nextAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + lockMinutes * 60 * 1000)
          : null,
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshExpiry(): Date {
    const days = this.configService.get<number>(
      'REFRESH_TOKEN_EXPIRES_IN_DAYS',
      30,
    );
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private accessTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
  }

  private toSessionUser(user: SessionUser): SessionUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      employee: user.employee,
    };
  }
}
