import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpaceMember, SpaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddSpaceMemberDto } from './dto/add-space-member.dto';
import { UpdateSpaceMemberRoleDto } from './dto/update-space-member-role.dto';
import {
  SpaceMemberResponseDto,
  SpaceMemberUserResponseDto,
} from './dto/space-member-response.dto';

const ROLE_PRIORITY: Record<SpaceRole, number> = {
  [SpaceRole.VIEWER]: 0,
  [SpaceRole.EDITOR]: 1,
  [SpaceRole.MANAGER]: 2,
  [SpaceRole.OWNER]: 3,
};

@Injectable()
export class SpaceMemberService {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers(
    actorId: string,
    spaceId: string,
  ): Promise<SpaceMemberResponseDto[]> {
    await this.assertRole(spaceId, actorId, SpaceRole.VIEWER);

    const members = await this.prisma.spaceMember.findMany({
      where: { spaceId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => this.toResponse(member));
  }

  async addMember(
    actorId: string,
    spaceId: string,
    dto: AddSpaceMemberDto,
  ): Promise<SpaceMemberResponseDto> {
    await this.ensureActorIsOwner(actorId, spaceId);

    if (dto.userId === actorId) {
      throw new BadRequestException('You are already the owner of this space.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const existing = await this.prisma.spaceMember.findUnique({
      where: {
        spaceId_userId: {
          spaceId,
          userId: dto.userId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('User is already a member of this space.');
    }

    const role = dto.role ?? SpaceRole.VIEWER;

    if (role === SpaceRole.OWNER) {
      throw new BadRequestException(
        'Only the primary owner can hold the owner role.',
      );
    }

    const member = await this.prisma.spaceMember.create({
      data: {
        spaceId,
        userId: dto.userId,
        role,
      },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    return this.toResponse(member);
  }

  async updateMemberRole(
    actorId: string,
    spaceId: string,
    memberId: string,
    dto: UpdateSpaceMemberRoleDto,
  ): Promise<SpaceMemberResponseDto> {
    await this.ensureActorIsOwner(actorId, spaceId);

    if (dto.role === SpaceRole.OWNER) {
      throw new BadRequestException(
        'Owner role can only belong to the space owner.',
      );
    }

    const member = await this.prisma.spaceMember.findFirst({
      where: { id: memberId, spaceId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    if (!member) {
      throw new NotFoundException('Space member not found.');
    }

    if (member.userId === actorId) {
      throw new BadRequestException(
        'Owners cannot change their own membership role.',
      );
    }

    if (member.role === SpaceRole.OWNER) {
      throw new BadRequestException('Cannot modify the owner membership.');
    }

    const updated = await this.prisma.spaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    return this.toResponse(updated);
  }

  async removeMember(
    actorId: string,
    spaceId: string,
    memberId: string,
  ): Promise<void> {
    await this.ensureActorIsOwner(actorId, spaceId);

    const member = await this.prisma.spaceMember.findFirst({
      where: { id: memberId, spaceId },
      select: { id: true, userId: true, role: true },
    });

    if (!member) {
      throw new NotFoundException('Space member not found.');
    }

    if (member.userId === actorId) {
      throw new BadRequestException('Owners cannot remove themselves.');
    }

    if (member.role === SpaceRole.OWNER) {
      throw new BadRequestException('Cannot remove the space owner.');
    }

    await this.prisma.spaceMember.delete({ where: { id: memberId } });
  }

  async assertRole(
    spaceId: string,
    userId: string,
    requiredRole: SpaceRole,
  ): Promise<SpaceMember> {
    const membership = await this.prisma.spaceMember.findUnique({
      where: {
        spaceId_userId: {
          spaceId,
          userId,
        },
      },
    });

    if (!membership) {
      const spaceExists = await this.prisma.space.findUnique({
        where: { id: spaceId },
        select: { id: true },
      });

      if (!spaceExists) {
        throw new NotFoundException('Space not found.');
      }

      throw new ForbiddenException(
        'You do not have permission to access this space.',
      );
    }

    if (!this.hasSufficientRole(membership.role, requiredRole)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }

    return membership;
  }

  async getSpaceIdForFile(fileId: string): Promise<string> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { spaceId: true },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    return file.spaceId;
  }

  async getSpaceIdForConversation(conversationId: string): Promise<string> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { spaceId: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    return conversation.spaceId;
  }

  async getSpaceIdForReminder(reminderId: string): Promise<string> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      select: { spaceId: true },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found.');
    }

    return reminder.spaceId;
  }

  private hasSufficientRole(
    current: SpaceRole,
    required: SpaceRole,
  ): boolean {
    return ROLE_PRIORITY[current] >= ROLE_PRIORITY[required];
  }

  private async ensureActorIsOwner(
    actorId: string,
    spaceId: string,
  ): Promise<void> {
    const membership = await this.assertRole(spaceId, actorId, SpaceRole.OWNER);

    const space = await this.prisma.space.findUnique({
      where: { id: membership.spaceId },
      select: { ownerId: true },
    });

    if (!space) {
      throw new NotFoundException('Space not found.');
    }

    if (space.ownerId !== actorId) {
      throw new ForbiddenException(
        'Only the space owner can manage members.',
      );
    }
  }

  private toResponse(
    member: SpaceMember & {
      user: { id: string; email: string; displayName: string | null };
    },
  ): SpaceMemberResponseDto {
    return new SpaceMemberResponseDto({
      id: member.id,
      spaceId: member.spaceId,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      user: new SpaceMemberUserResponseDto({
        id: member.user.id,
        email: member.user.email,
        displayName: member.user.displayName ?? null,
      }),
    });
  }
}
