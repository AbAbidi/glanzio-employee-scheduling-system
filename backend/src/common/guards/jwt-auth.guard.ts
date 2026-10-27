import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import type { AuthenticatedUser } from '../auth/authenticated-user.type';
import { UserStatus, type User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

type AccessTokenPayload = {
  sub: string;
  email: string | null;
  role: AuthenticatedUser['role'];
  iat?: number;
  ver?: number;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('A valid access token is required.');
    }

    const token = authorization.slice('Bearer '.length).trim();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'The access token is invalid or expired.',
      );
    }

    if (!payload || typeof payload.sub !== 'string' || !isUUID(payload.sub)) {
      throw new UnauthorizedException(
        'The access token is invalid or expired.',
      );
    }

    let user: Pick<
      User,
      'id' | 'email' | 'role' | 'status' | 'passwordChangedAt' | 'authVersion'
    > | null;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          passwordChangedAt: true,
          authVersion: true,
        },
      });
    } catch {
      // A database outage is not an expired credential. Returning 401 here
      // causes clients to rotate sessions or sign users out unnecessarily.
      throw new ServiceUnavailableException(
        'Authentication is temporarily unavailable. Please try again.',
      );
    }

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This account is not active.');
    }

    if ((payload.ver ?? 0) !== (user.authVersion ?? 0)) {
      throw new UnauthorizedException(
        'Your access rights changed. Please sign in again.',
      );
    }

    if (
      payload.iat &&
      user.passwordChangedAt &&
      Math.floor(user.passwordChangedAt.getTime() / 1000) > payload.iat
    ) {
      throw new UnauthorizedException(
        'The password changed after this access token was issued.',
      );
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return true;
  }
}
