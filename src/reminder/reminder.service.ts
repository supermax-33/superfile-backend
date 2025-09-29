import { Injectable, NotFoundException } from '@nestjs/common';
import { File, Prisma, Reminder } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ReminderResponseDto } from './dto/reminder-response.dto';
import { ReminderFileResponseDto } from './dto/reminder-file-response.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

@Injectable()
export class ReminderService {
  constructor(private readonly prisma: PrismaService) {}

  async createReminder(
    ownerId: string,
    dto: CreateReminderDto,
  ): Promise<ReminderResponseDto> {
    const fileIds = this.uniqueIds(dto.fileIds);
    await this.assertFilesBelongToUser(ownerId, fileIds);

    const reminder = await this.prisma.reminder.create({
      data: {
        ownerId,
        title: dto.title,
        note: dto.note ?? null,
        remindAt: new Date(dto.remindAt),
        ...(fileIds.length
          ? { files: { connect: fileIds.map((id) => ({ id })) } }
          : {}),
      },
      include: { files: true },
    });

    return this.toReminderResponse(reminder);
  }

  async listReminders(ownerId: string): Promise<ReminderResponseDto[]> {
    const reminders = await this.prisma.reminder.findMany({
      where: { ownerId },
      orderBy: { remindAt: 'asc' },
      include: { files: true },
    });

    return reminders.map((reminder) => this.toReminderResponse(reminder));
  }

  async getReminder(
    ownerId: string,
    reminderId: string,
  ): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      include: { files: true },
    });

    if (!reminder || reminder.ownerId !== ownerId) {
      throw new NotFoundException('Reminder not found.');
    }

    return this.toReminderResponse(reminder);
  }

  async updateReminder(
    ownerId: string,
    reminderId: string,
    dto: UpdateReminderDto,
  ): Promise<ReminderResponseDto> {
    const existing = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      select: { ownerId: true },
    });

    if (!existing || existing.ownerId !== ownerId) {
      throw new NotFoundException('Reminder not found.');
    }

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
      await this.assertFilesBelongToUser(ownerId, fileIds);
      data.files = { set: fileIds.map((id) => ({ id })) };
    }

    const reminder = await this.prisma.reminder.update({
      where: { id: reminderId },
      data,
      include: { files: true },
    });

    return this.toReminderResponse(reminder);
  }

  async deleteReminder(ownerId: string, reminderId: string): Promise<void> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, ownerId },
      select: { id: true },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found.');
    }

    await this.prisma.reminder.delete({ where: { id: reminderId } });
  }

  async addFilesToReminder(
    ownerId: string,
    reminderId: string,
    fileIds: string[],
  ): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      include: { files: { select: { id: true } } },
    });

    if (!reminder || reminder.ownerId !== ownerId) {
      throw new NotFoundException('Reminder not found.');
    }

    const uniqueFileIds = this.uniqueIds(fileIds);
    await this.assertFilesBelongToUser(ownerId, uniqueFileIds);

    const currentlyLinked = new Set(reminder.files.map((file) => file.id));
    const connectIds = uniqueFileIds.filter((id) => !currentlyLinked.has(id));

    if (connectIds.length === 0) {
      const current = await this.prisma.reminder.findUnique({
        where: { id: reminderId },
        include: { files: true },
      });
      if (!current) {
        throw new NotFoundException('Reminder not found.');
      }
      return this.toReminderResponse(current);
    }

    const updated = await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { files: { connect: connectIds.map((id) => ({ id })) } },
      include: { files: true },
    });

    return this.toReminderResponse(updated);
  }

  async removeFileFromReminder(
    ownerId: string,
    reminderId: string,
    fileId: string,
  ): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      select: { ownerId: true },
    });

    if (!reminder || reminder.ownerId !== ownerId) {
      throw new NotFoundException('Reminder not found.');
    }

    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId: ownerId },
      select: { id: true },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    const linked = await this.prisma.reminder.findFirst({
      where: { id: reminderId, ownerId, files: { some: { id: fileId } } },
      select: { id: true },
    });

    if (!linked) {
      throw new NotFoundException('File is not linked to this reminder.');
    }

    const updated = await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { files: { disconnect: [{ id: fileId }] } },
      include: { files: true },
    });

    return this.toReminderResponse(updated);
  }

  private async assertFilesBelongToUser(
    ownerId: string,
    fileIds: string[],
  ): Promise<void> {
    if (fileIds.length === 0) {
      return;
    }

    const files = await this.prisma.file.findMany({
      where: {
        id: { in: fileIds },
        userId: ownerId,
      },
      select: { id: true },
    });

    if (files.length !== fileIds.length) {
      throw new NotFoundException('One or more files were not found.');
    }
  }

  private uniqueIds(ids?: string[]): string[] {
    if (!ids || ids.length === 0) {
      return [];
    }

    return Array.from(new Set(ids));
  }

  private toReminderResponse(
    reminder: Reminder & { files: File[] },
  ): ReminderResponseDto {
    return new ReminderResponseDto({
      id: reminder.id,
      ownerId: reminder.ownerId,
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
            userId: file.userId,
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
