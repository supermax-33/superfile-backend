import { Injectable, NotFoundException } from '@nestjs/common';
import { File, Prisma, Reminder, SpaceRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ReminderResponseDto } from './dto/reminder-response.dto';
import { ReminderFileResponseDto } from './dto/reminder-file-response.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { SpaceMemberService } from '../space-member/space-member.service';

@Injectable()
export class ReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaceMembers: SpaceMemberService,
  ) {}

  async createReminder(
    userId: string,
    spaceId: string,
    dto: CreateReminderDto,
  ): Promise<ReminderResponseDto> {
    await this.spaceMembers.assertRoleForSpace(
      userId,
      spaceId,
      SpaceRole.EDITOR,
    );

    const fileIds = this.uniqueIds(dto.fileIds);
    await this.assertFilesBelongToSpace(spaceId, fileIds);

    const reminder = await this.prisma.reminder.create({
      data: {
        spaceId,
        title: dto.title,
        note: dto.note ?? null,
        remindAt: new Date(dto.remindAt),
        ...(fileIds.length
          ? { files: { connect: fileIds.map((id) => ({ id })) } }
          : {}),
      },
      include: { files: true, space: { select: { ownerId: true } } },
    });

    return this.toReminderResponse(reminder);
  }

  async listReminders(
    userId: string,
    spaceId: string,
  ): Promise<ReminderResponseDto[]> {
    await this.spaceMembers.assertRoleForSpace(
      userId,
      spaceId,
      SpaceRole.VIEWER,
    );

    const reminders = await this.prisma.reminder.findMany({
      where: { spaceId },
      orderBy: { remindAt: 'asc' },
      include: { files: true, space: { select: { ownerId: true } } },
    });

    return reminders.map((reminder) => this.toReminderResponse(reminder));
  }

  async getReminder(
    userId: string,
    spaceId: string,
    reminderId: string,
  ): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, spaceId },
      include: { files: true, space: { select: { ownerId: true } } },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found.');
    }

    await this.spaceMembers.assertRoleForSpace(
      userId,
      reminder.spaceId,
      SpaceRole.VIEWER,
    );

    return this.toReminderResponse(reminder);
  }

  async updateReminder(
    userId: string,
    spaceId: string,
    reminderId: string,
    dto: UpdateReminderDto,
  ): Promise<ReminderResponseDto> {
    const existing = await this.prisma.reminder.findFirst({
      where: { id: reminderId, spaceId },
      select: { id: true, space: { select: { ownerId: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Reminder not found.');
    }

    await this.spaceMembers.assertRoleForSpace(
      userId,
      spaceId,
      SpaceRole.EDITOR,
    );

    const data: Prisma.ReminderUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = dto.title;
    }

    if (dto.note !== undefined) {
      data.note = dto.note ?? null;
    }

    if (dto.remindAt !== undefined) {
      data.remindAt = new Date(dto.remindAt);
    }

    if (dto.fileIds !== undefined) {
      const fileIds = this.uniqueIds(dto.fileIds);
      await this.assertFilesBelongToSpace(spaceId, fileIds);
      data.files = { set: fileIds.map((id) => ({ id })) };
    }

    const reminder = await this.prisma.reminder.update({
      where: { id: reminderId },
      data,
      include: { files: true, space: { select: { ownerId: true } } },
    });

    return this.toReminderResponse(reminder);
  }

  async deleteReminder(
    userId: string,
    spaceId: string,
    reminderId: string,
  ): Promise<void> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, spaceId },
      select: { id: true, space: { select: { ownerId: true } } },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found.');
    }

    await this.spaceMembers.assertRoleForSpace(
      userId,
      spaceId,
      SpaceRole.MANAGER,
    );

    await this.prisma.reminder.delete({ where: { id: reminderId } });
  }

  async addFilesToReminder(
    userId: string,
    spaceId: string,
    reminderId: string,
    fileIds: string[],
  ): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, spaceId },
      include: {
        files: { select: { id: true } },
        space: { select: { ownerId: true } },
      },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found.');
    }

    await this.spaceMembers.assertRoleForSpace(
      userId,
      spaceId,
      SpaceRole.EDITOR,
    );

    const uniqueFileIds = this.uniqueIds(fileIds);
    await this.assertFilesBelongToSpace(spaceId, uniqueFileIds);

    const currentlyLinked = new Set(reminder.files.map((file) => file.id));
    const connectIds = uniqueFileIds.filter((id) => !currentlyLinked.has(id));

    if (connectIds.length === 0) {
      const current = await this.prisma.reminder.findFirst({
        where: { id: reminderId, spaceId },
        include: { files: true, space: { select: { ownerId: true } } },
      });
      if (!current) {
        throw new NotFoundException('Reminder not found.');
      }

      await this.spaceMembers.assertRoleForSpace(
        userId,
        spaceId,
        SpaceRole.EDITOR,
      );
      return this.toReminderResponse(current);
    }

    const updated = await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { files: { connect: connectIds.map((id) => ({ id })) } },
      include: { files: true, space: { select: { ownerId: true } } },
    });

    return this.toReminderResponse(updated);
  }

  async removeFileFromReminder(
    userId: string,
    spaceId: string,
    reminderId: string,
    fileId: string,
  ): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, spaceId },
      select: { id: true, space: { select: { ownerId: true } } },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found.');
    }

    await this.spaceMembers.assertRoleForSpace(
      userId,
      spaceId,
      SpaceRole.EDITOR,
    );

    const file = await this.prisma.file.findFirst({
      where: { id: fileId, spaceId },
      select: { id: true },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    const linked = await this.prisma.reminder.findFirst({
      where: { id: reminderId, spaceId, files: { some: { id: fileId } } },
      select: { id: true },
    });

    if (!linked) {
      throw new NotFoundException('File is not linked to this reminder.');
    }

    const updated = await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { files: { disconnect: [{ id: fileId }] } },
      include: { files: true, space: { select: { ownerId: true } } },
    });

    return this.toReminderResponse(updated);
  }

  private async assertFilesBelongToSpace(
    spaceId: string,
    fileIds: string[],
  ): Promise<void> {
    if (fileIds.length === 0) {
      return;
    }

    const files = await this.prisma.file.findMany({
      where: {
        id: { in: fileIds },
        spaceId,
      },
      select: { id: true },
    });

    if (files.length !== fileIds.length) {
      throw new NotFoundException(
        'One or more files were not found in the target space.',
      );
    }
  }

  private uniqueIds(ids?: string[]): string[] {
    if (!ids || ids.length === 0) {
      return [];
    }

    return Array.from(new Set(ids));
  }

  private toReminderResponse(
    reminder: Reminder & { files: File[]; space: { ownerId: string } },
  ): ReminderResponseDto {
    return new ReminderResponseDto({
      id: reminder.id,
      spaceId: reminder.spaceId,
      ownerId: reminder.space.ownerId,
      title: reminder.title,
      note: reminder.note ?? null,
      remindAt: reminder.remindAt,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
      files: reminder.files.map(
        (file) =>
          new ReminderFileResponseDto({
            id: file.id,
            spaceId: file.spaceId,
            userId: reminder.space.ownerId,
            filename: file.filename,
            mimetype: file.mimetype,
            size: Number(file.size),
            status: file.status,
            uploadedAt: file.uploadedAt,
            updatedAt: file.updatedAt,
          }),
      ),
    });
  }
}
