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
import { RequireSpaceRole } from '../space-member/decorators/require-space-role.decorator';
import { SpaceRoleGuard } from '../space-member/guards/space-role.guard';
import { SpaceRole } from '@prisma/client';
import { RequestWithUser } from 'types';

@UseGuards(JwtAuthGuard)
@UseFilters(JwtExceptionFilter)
@Controller('spaces/:spaceId/reminders')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Version('1')
  @Post()
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.EDITOR, { spaceIdParam: 'spaceId' })
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
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.VIEWER, { spaceIdParam: 'spaceId' })
  async list(
    @Request() req: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
  ): Promise<ReminderResponseDto[]> {
    const userId = this.getUserId(req);
    return this.reminderService.listReminders(userId, spaceId);
  }

  @Version('1')
  @Get(':id')
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.VIEWER, { spaceIdParam: 'spaceId' })
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
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.EDITOR, { spaceIdParam: 'spaceId' })
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.MANAGER, { spaceIdParam: 'spaceId' })
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
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.EDITOR, { spaceIdParam: 'spaceId' })
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
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.EDITOR, { spaceIdParam: 'spaceId' })
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
