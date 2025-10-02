import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { SpaceRole } from '@prisma/client';
import { RequireSpaceRole } from 'src/space-member/decorators/space-role.decorator';
import { SpaceRoleGuard } from 'src/space-member/guards/space-role.guard';

@UseGuards(JwtAuthGuard, SpaceRoleGuard)
@UseFilters(JwtExceptionFilter)
@Controller('spaces/:spaceId/reminders')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Version('1')
  @Post()
  @RequireSpaceRole(SpaceRole.EDITOR, { source: 'param', key: 'spaceId' })
  async create(
    @Body() dto: CreateReminderDto,
    @Request() req: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
  ): Promise<ReminderResponseDto> {
    const userId = this.getUserId(req);
    return this.reminderService.createReminder(userId, spaceId, dto);
  }

  @Version('1')
  @Get()
  @RequireSpaceRole(SpaceRole.VIEWER, { source: 'param', key: 'spaceId' })
  async list(
    @Request() req: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
  ): Promise<ReminderResponseDto[]> {
    const userId = this.getUserId(req);
    return this.reminderService.listReminders(userId, spaceId);
  }

  @Version('1')
  @Get(':id')
  @RequireSpaceRole(SpaceRole.VIEWER, { source: 'param', key: 'spaceId' })
  async findOne(
    @Request() req: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Param('id', new ParseUUIDPipe()) reminderId: string,
  ): Promise<ReminderResponseDto> {
    const userId = this.getUserId(req);
    return this.reminderService.getReminder(userId, spaceId, reminderId);
  }

  @Version('1')
  @Patch(':id')
  @RequireSpaceRole(SpaceRole.EDITOR, { source: 'param', key: 'spaceId' })
  async update(
    @Request() req: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Param('id', new ParseUUIDPipe()) reminderId: string,
    @Body() dto: UpdateReminderDto,
  ): Promise<ReminderResponseDto> {
    const userId = this.getUserId(req);
    return this.reminderService.updateReminder(
      userId,
      spaceId,
      reminderId,
      dto,
    );
  }

  @Version('1')
  @Delete(':id')
  @RequireSpaceRole(SpaceRole.MANAGER, { source: 'param', key: 'spaceId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Request() req: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Param('id', new ParseUUIDPipe()) reminderId: string,
  ): Promise<void> {
    const userId = this.getUserId(req);
    await this.reminderService.deleteReminder(userId, spaceId, reminderId);
  }

  @Version('1')
  @Post(':id/files')
  @RequireSpaceRole(SpaceRole.EDITOR, { source: 'param', key: 'spaceId' })
  async addFiles(
    @Request() req: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Param('id', new ParseUUIDPipe()) reminderId: string,
    @Body() dto: AddReminderFilesDto,
  ): Promise<ReminderResponseDto> {
    const userId = this.getUserId(req);
    return this.reminderService.addFilesToReminder(
      userId,
      spaceId,
      reminderId,
      dto.fileIds,
    );
  }

  @Version('1')
  @Delete(':id/files/:fileId')
  @RequireSpaceRole(SpaceRole.EDITOR, { source: 'param', key: 'spaceId' })
  async removeFile(
    @Request() req: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Param('id', new ParseUUIDPipe()) reminderId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
  ): Promise<ReminderResponseDto> {
    const userId = this.getUserId(req);
    return this.reminderService.removeFileFromReminder(
      userId,
      spaceId,
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
