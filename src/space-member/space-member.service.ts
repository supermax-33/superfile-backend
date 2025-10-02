import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SpaceMemberResponseDto,
  SpaceMemberUserDto,
} from './dto/space-member-response.dto';
import { CreateSpaceMemberDto } from './dto/create-space-member.dto';
import { UpdateSpaceMemberDto } from './dto/update-space-member.dto';
import { hasSufficientRole } from './space-role.utils';

@Injectable()
export class SpaceMemberService {
  constructor(private readonly prisma: PrismaService) {}

  async assertRoleForSpace(
    userId: string,
    spaceId: string,
    required: SpaceRole,
  ): Promise<SpaceRole> {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: {
        ownerId: true,
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!space) {
      throw new NotFoundException('Space not found.');
    }

    let role: SpaceRole | null = null;

    if (space.ownerId === userId) {
      role = SpaceRole.OWNER;
    } else if (space.members.length > 0) {
      role = space.members[0].role;
    }

    if (!role) {
      throw new ForbiddenException(
        'You do not have permission to access this space.',
      );
    }

    if (!hasSufficientRole(role, required)) {
      throw new ForbiddenException(
        'You do not have the required role for this operation.',
      );
    }

    return role;
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

  async listMembers(ownerId: string, spaceId: string): Promise<
    SpaceMemberResponseDto[]
  > {
    await this.assertRoleForSpace(ownerId, spaceId, SpaceRole.OWNER);

    const members = await this.prisma.spaceMember.findMany({
      where: { spaceId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => this.toDto(member));
  }

  async addMember(
    ownerId: string,
    spaceId: string,
    dto: CreateSpaceMemberDto,
  ): Promise<SpaceMemberResponseDto> {
    await this.assertRoleForSpace(ownerId, spaceId, SpaceRole.OWNER);

    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { ownerId: true },
    });

    if (!space) {
      throw new NotFoundException('Space not found.');
    }

    if (dto.userId === space.ownerId) {
      throw new BadRequestException(
        'The space owner already has full access to this space.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true, displayName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const existing = await this.prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId: dto.userId } },
    });

    if (existing) {
      throw new BadRequestException('User is already a member of this space.');
    }

    if (dto.role === SpaceRole.OWNER) {
      throw new BadRequestException('Owner role can only be assigned to the space owner.');
    }

    const member = await this.prisma.spaceMember.create({
      data: {
        spaceId,
        userId: dto.userId,
        role: dto.role,
      },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    return this.toDto(member);
  }

  async updateMemberRole(
    ownerId: string,
    spaceId: string,
    memberId: string,
    dto: UpdateSpaceMemberDto,
  ): Promise<SpaceMemberResponseDto> {
    await this.assertRoleForSpace(ownerId, spaceId, SpaceRole.OWNER);

    if (dto.role === SpaceRole.OWNER) {
      throw new BadRequestException('Owner role can only be assigned to the space owner.');
    }

    const member = await this.prisma.spaceMember.findFirst({
      where: { id: memberId, spaceId },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        space: { select: { ownerId: true } },
      },
    });

    if (!member) {
      throw new NotFoundException('Space member not found.');
    }

    if (member.userId === member.space.ownerId) {
      throw new BadRequestException('The space owner role cannot be modified.');
    }

    const updated = await this.prisma.spaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    return this.toDto(updated);
  }

  async removeMember(
    ownerId: string,
    spaceId: string,
    memberId: string,
  ): Promise<void> {
    await this.assertRoleForSpace(ownerId, spaceId, SpaceRole.OWNER);

    const member = await this.prisma.spaceMember.findFirst({
      where: { id: memberId, spaceId },
      include: { space: { select: { ownerId: true } } },
    });

    if (!member) {
      throw new NotFoundException('Space member not found.');
    }

    if (member.userId === member.space.ownerId) {
      throw new BadRequestException('The space owner cannot be removed from the space.');
    }

    await this.prisma.spaceMember.delete({ where: { id: memberId } });
  }

  private toDto(member: {
    id: string;
    spaceId: string;
    userId: string;
    role: SpaceRole;
    createdAt: Date;
    updatedAt: Date;
    user: { id: string; email: string; displayName: string | null };
  }): SpaceMemberResponseDto {
    return new SpaceMemberResponseDto({
      id: member.id,
      spaceId: member.spaceId,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      user: new SpaceMemberUserDto({
        id: member.user.id,
        email: member.user.email,
        displayName: member.user.displayName ?? null,
      }),
    });
  }
}
