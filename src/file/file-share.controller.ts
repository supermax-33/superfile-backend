import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  Version,
} from '@nestjs/common';

import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'types';
import { FileShareService } from './file-share.service';
import { CreateFileShareDto } from './dto/create-file-share.dto';
import { FileShareResponseDto } from './dto/file-share-response.dto';
import { PublicFileShareResponseDto } from './dto/public-file-share-response.dto';
import { SendFileShareEmailDto } from './dto/send-file-share-email.dto';
import { SpaceRole } from '@prisma/client';
import { RequireSpaceRole } from '../space-member/decorators/space-role.decorator';
import { SpaceRoleGuard } from '../space-member/guards/space-role.guard';

@Controller('files')
@UseFilters(JwtExceptionFilter)
@UseGuards(JwtAuthGuard, SpaceRoleGuard)
export class FileShareController {
  constructor(private readonly fileShareService: FileShareService) {}

  private extractUserId(request: RequestWithUser): string {
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('User context is required.');
    }

    return userId;
  }

  @Version('1')
  @Post(':id/share')
  @RequireSpaceRole(SpaceRole.EDITOR, { source: 'file', param: 'id' })
  async createShare(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
    @Body() body: CreateFileShareDto,
  ): Promise<FileShareResponseDto> {
    const userId = this.extractUserId(request);
    return this.fileShareService.createShare(userId, fileId, body);
  }

  @Version('1')
  @Get(':id/shares')
  @RequireSpaceRole(SpaceRole.EDITOR, { source: 'file', param: 'id' })
  async listShares(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<FileShareResponseDto[]> {
    const userId = this.extractUserId(request);
    return this.fileShareService.listShares(userId, fileId);
  }

  @Version('1')
  @Delete(':id/shares/:shareId')
  @RequireSpaceRole(SpaceRole.EDITOR, { source: 'file', param: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeShare(
    @Param('id') fileId: string,
    @Param('shareId') shareId: string,
    @Req() request: RequestWithUser,
  ): Promise<void> {
    const userId = this.extractUserId(request);
    await this.fileShareService.revokeShare(userId, fileId, shareId);
  }

  @Version('1')
  @Post(':id/share/email')
  @RequireSpaceRole(SpaceRole.EDITOR, { source: 'file', param: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendShareEmail(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
    @Body() body: SendFileShareEmailDto,
  ): Promise<void> {
    const userId = this.extractUserId(request);
    await this.fileShareService.sendShareEmail(
      userId,
      fileId,
      body.shareId,
      body.recipientEmail,
    );
  }
}

@Controller('share')
export class PublicFileShareController {
  constructor(private readonly fileShareService: FileShareService) {}

  @Version('1')
  @Get(':shareToken')
  async resolveShare(
    @Param('shareToken') shareToken: string,
  ): Promise<PublicFileShareResponseDto> {
    return this.fileShareService.getShareByToken(shareToken);
  }
}
