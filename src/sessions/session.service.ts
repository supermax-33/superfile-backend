import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Session } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  AssertSessionActiveParams,
  CreateSessionParams,
  RotateSessionParams,
  ValidateSessionParams,
} from 'types';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(params: CreateSessionParams): Promise<Session> {
    const { id, userId, refreshToken, ipAddress, userAgent, expiresAt } =
      params;

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    return this.prisma.session.create({
      data: {
        id,
        userId,
        refreshTokenHash,
        ipAddress,
        userAgent,
        lastUsedAt: new Date(),
        expiresAt,
      },
    });
  }

  async rotateSessionToken(params: RotateSessionParams): Promise<Session> {
    const { sessionId, refreshToken, ipAddress, userAgent, expiresAt } = params;
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Session is no longer active.');
    }

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        previousTokenHash: session.refreshTokenHash,
        refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });
  }

  async validateSessionToken(params: ValidateSessionParams): Promise<Session> {
    const { sessionId, userId, refreshToken } = params;
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Refresh session not found.');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked.');
    }

    if (session.expiresAt <= new Date()) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException('Refresh session expired.');
    }

    const matchesCurrent = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );
    if (matchesCurrent) {
      return session;
    }

    if (session.previousTokenHash) {
      const matchesPrevious = await bcrypt.compare(
        refreshToken,
        session.previousTokenHash,
      );
      if (matchesPrevious) {
        await this.revokeAllSessionsForUser(session.userId);
        throw new UnauthorizedException(
          'Refresh token re-use detected; all sessions have been revoked.',
        );
      }
    }

    throw new UnauthorizedException('Refresh token is invalid.');
  }

  async assertSessionIsActive(
    params: AssertSessionActiveParams,
  ): Promise<Session> {
    const { sessionId, userId } = params;
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Session not found.');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked.');
    }

    if (session.expiresAt <= new Date()) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException('Session has expired.');
    }

    return session;
  }

  async listActiveSessions(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeSessionForUser(userId: string, sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
