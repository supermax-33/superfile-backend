import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitationStatus, SpaceRole } from '@prisma/client';

import { SPACE_INVITATION_TTL_MS } from 'config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateSpaceInvitationDto } from './dto/create-space-invitation.dto';
import { SpaceInvitationResponseDto } from './dto/space-invitation-response.dto';
import {
  buildInvitationLink,
  generateInvitationToken,
  hashInvitationToken,
  normalizeInvitationEmail,
  trimTrailingSlashes,
} from './utils/invitation-helpers';

const DEFAULT_BASE_URL = 'https://myapp.com';

type SpaceInvitationWithRelations = {
  id: string;
  spaceId: string;
  email: string;
  invitedBy: string;
  status: InvitationStatus;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  space: { id: string; name: string };
  inviter: { id: string; email: string; displayName: string | null };
};

@Injectable()
export class SpaceInvitationService {
  private readonly baseInvitationUrl: string;
  private readonly invitationTtlMs: number;

  private readonly invitationInclude = {
    inviter: { select: { id: true, email: true, displayName: true } },
    space: { select: { id: true, name: true } },
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    configService: ConfigService,
  ) {
    const configuredBaseUrl =
      configService.get<string>('SPACE_INVITATION_BASE_URL') ??
      configService.get<string>('APP_BASE_URL') ??
      configService.get<string>('APP_URL') ??
      configService.get<string>('FRONTEND_URL') ??
      DEFAULT_BASE_URL;

    this.baseInvitationUrl = trimTrailingSlashes(configuredBaseUrl);

    const configuredTtl = configService.get<string | number>(
      'SPACE_INVITATION_TTL_MS',
    );
    const parsedTtl = Number(configuredTtl);
    this.invitationTtlMs = Number.isFinite(parsedTtl)
      ? parsedTtl
      : SPACE_INVITATION_TTL_MS;
  }

  async createInvitation(
    actorId: string,
    spaceId: string,
    dto: CreateSpaceInvitationDto,
  ): Promise<SpaceInvitationResponseDto> {
    await this.expirePendingInvitations(spaceId);

    const email = normalizeInvitationEmail(dto.email);
    const now = new Date();

    const [space, inviter, existingUser, existingMember, pendingInvite] =
      await Promise.all([
        this.prisma.space.findUnique({
          where: { id: spaceId },
          select: { id: true, name: true },
        }),
        this.prisma.user.findUnique({
          where: { id: actorId },
          select: { id: true, email: true, displayName: true },
        }),
        this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        }),
        this.prisma.spaceMember.findFirst({
          where: { spaceId, user: { is: { email } } },
          select: { id: true },
        }),
        this.prisma.spaceInvitation.findFirst({
          where: {
            spaceId,
            email,
            status: InvitationStatus.PENDING,
            expiresAt: { gt: now },
          },
          select: { id: true },
        }),
      ]);

    if (!space) {
      throw new NotFoundException('Space not found.');
    }

    if (!inviter) {
      throw new NotFoundException('Inviting user not found.');
    }

    if (normalizeInvitationEmail(inviter.email) === email) {
      throw new BadRequestException('You are already a member of this space.');
    }

    if (existingMember) {
      throw new BadRequestException('User is already a member of this space.');
    }

    if (pendingInvite) {
      throw new BadRequestException(
        'An invitation is already pending for this email address.',
      );
    }

    const rawToken = generateInvitationToken();
    const expiresAt = new Date(Date.now() + this.invitationTtlMs);

    const invitation = (await this.prisma.spaceInvitation.create({
      data: {
        spaceId,
        email,
        invitedBy: actorId,
        tokenHash: hashInvitationToken(rawToken),
        expiresAt,
      },
      include: this.invitationInclude,
    })) as SpaceInvitationWithRelations;

    const acceptUrl = buildInvitationLink(
      this.baseInvitationUrl,
      invitation.id,
      'accept',
      rawToken,
    );
    const rejectUrl = buildInvitationLink(
      this.baseInvitationUrl,
      invitation.id,
      'reject',
      rawToken,
    );

    await this.mailService.sendSpaceInvitationEmail({
      email,
      spaceName: invitation.space.name,
      inviterName: inviter.displayName ?? inviter.email,
      acceptUrl,
      rejectUrl,
      existingUser: Boolean(existingUser),
      expiresAt,
    });

    return this.toResponse(invitation);
  }

  async listInvitations(
    spaceId: string,
  ): Promise<SpaceInvitationResponseDto[]> {
    await this.expirePendingInvitations(spaceId);

    const invitations = (await this.prisma.spaceInvitation.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
      include: this.invitationInclude,
    })) as SpaceInvitationWithRelations[];

    return invitations.map((invitation) => this.toResponse(invitation));
  }

  async acceptInvitation(
    invitationId: string,
    token: string,
    userId: string,
  ): Promise<SpaceInvitationResponseDto> {
    const invitation = await this.getInvitation(invitationId);
    this.assertToken(token);
    await this.ensurePending(invitation);
    this.verifyToken(invitation, token);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (normalizeInvitationEmail(user.email) !== invitation.email) {
      throw new ForbiddenException(
        'You must sign in with the email address that was invited.',
      );
    }

    const membership = await this.prisma.spaceMember.findUnique({
      where: {
        spaceId_userId: {
          spaceId: invitation.spaceId,
          userId: user.id,
        },
      },
      select: { id: true },
    });

    const updated = (await this.prisma.$transaction(async (tx) => {
      if (!membership) {
        await tx.spaceMember.create({
          data: {
            spaceId: invitation.spaceId,
            userId: user.id,
            role: SpaceRole.VIEWER,
          },
        });
      }

      return tx.spaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
        include: this.invitationInclude,
      });
    })) as SpaceInvitationWithRelations;

    return this.toResponse(updated);
  }

  async rejectInvitation(
    invitationId: string,
    token: string,
  ): Promise<SpaceInvitationResponseDto> {
    const invitation = await this.getInvitation(invitationId);
    this.assertToken(token);
    await this.ensurePending(invitation);
    this.verifyToken(invitation, token);

    const updated = (await this.prisma.spaceInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REJECTED },
      include: this.invitationInclude,
    })) as SpaceInvitationWithRelations;

    return this.toResponse(updated);
  }

  private toResponse(
    invitation: SpaceInvitationWithRelations,
  ): SpaceInvitationResponseDto {
    return new SpaceInvitationResponseDto({
      id: invitation.id,
      space: { id: invitation.space.id, name: invitation.space.name },
      email: invitation.email,
      status: invitation.status,
      invitedBy: {
        id: invitation.inviter.id,
        email: invitation.inviter.email,
        displayName: invitation.inviter.displayName,
      },
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    });
  }

  private async getInvitation(
    invitationId: string,
  ): Promise<SpaceInvitationWithRelations> {
    const invitation = (await this.prisma.spaceInvitation.findUnique({
      where: { id: invitationId },
      include: this.invitationInclude,
    })) as SpaceInvitationWithRelations | null;

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    return invitation;
  }

  private async ensurePending(
    invitation: SpaceInvitationWithRelations,
  ): Promise<void> {
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation has already been processed.');
    }

    if (invitation.expiresAt <= new Date()) {
      await this.prisma.spaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException('Invitation has expired.');
    }
  }

  private async expirePendingInvitations(spaceId: string): Promise<void> {
    await this.prisma.spaceInvitation.updateMany({
      where: {
        spaceId,
        status: InvitationStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: InvitationStatus.EXPIRED },
    });
  }

  private verifyToken(
    invitation: SpaceInvitationWithRelations,
    token: string,
  ): void {
    const hashed = hashInvitationToken(token);
    if (hashed !== invitation.tokenHash) {
      throw new ForbiddenException('Invalid invitation token.');
    }
  }

  private assertToken(token: string): void {
    if (!token) {
      throw new BadRequestException('Invitation token is required.');
    }
  }
}
