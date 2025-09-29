import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseFilters,
  UseGuards,
  UnauthorizedException,
  Version,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';
import { ReminderService } from './reminder.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ReminderResponseDto } from './dto/reminder-response.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { AddReminderFilesDto } from './dto/add-reminder-files.dto';
import { RequestWithUser } from 'types';

@UseGuards(JwtAuthGuard)
@UseFilters(JwtExceptionFilter)
@Controller('reminders')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Version('1')
  @Post()
  async create(
    @Body() dto: CreateReminderDto,
    @Request() req: RequestWithUser,
  ): Promise<ReminderResponseDto> {
    const ownerId = this.getUserId(req);
    return this.reminderService.createReminder(ownerId, dto);
  }

  @Version('1')
  @Get()
  async list(@Request() req: RequestWithUser): Promise<ReminderResponseDto[]> {
    const ownerId = this.getUserId(req);
    return this.reminderService.listReminders(ownerId);
  }

  @Version('1')
  @Get(':id')
  async findOne(
    @Request() req: RequestWithUser,
    @Param('id') reminderId: string,
  ): Promise<ReminderResponseDto> {
    const ownerId = this.getUserId(req);
    return this.reminderService.getReminder(ownerId, reminderId);
  }

  @Version('1')
  @Patch(':id')
  async update(
    @Request() req: RequestWithUser,
    @Param('id') reminderId: string,
    @Body() dto: UpdateReminderDto,
  ): Promise<ReminderResponseDto> {
    const ownerId = this.getUserId(req);
    return this.reminderService.updateReminder(ownerId, reminderId, dto);
  }

  @Version('1')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Request() req: RequestWithUser,
    @Param('id') reminderId: string,
  ): Promise<void> {
    const ownerId = this.getUserId(req);
    await this.reminderService.deleteReminder(ownerId, reminderId);
  }

  @Version('1')
  @Post(':id/files')
  async addFiles(
    @Request() req: RequestWithUser,
    @Param('id') reminderId: string,
    @Body() dto: AddReminderFilesDto,
  ): Promise<ReminderResponseDto> {
    const ownerId = this.getUserId(req);
    return this.reminderService.addFilesToReminder(
      ownerId,
      reminderId,
      dto.fileIds,
    );
  }

  @Version('1')
  @Delete(':id/files/:fileId')
  async removeFile(
    @Request() req: RequestWithUser,
    @Param('id') reminderId: string,
    @Param('fileId') fileId: string,
  ): Promise<ReminderResponseDto> {
    const ownerId = this.getUserId(req);
    return this.reminderService.removeFileFromReminder(
      ownerId,
      reminderId,
      fileId,
    );
  }

  private getUserId(request: RequestWithUser): string {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user context is required to manage reminders.',
      );
    }

    return userId;
  }
}
