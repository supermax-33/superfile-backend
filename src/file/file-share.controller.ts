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
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'types';
import { FileOwnerGuard } from './guards/file-owner.guard';
import { FileShareService } from './file-share.service';
import { CreateFileShareDto } from './dto/create-file-share.dto';
import { FileShareResponseDto } from './dto/file-share-response.dto';
import { PublicFileShareResponseDto } from './dto/public-file-share-response.dto';
import { SendFileShareEmailDto } from './dto/send-file-share-email.dto';

@Controller('files')
@UseFilters(JwtExceptionFilter)
@UseGuards(JwtAuthGuard, FileOwnerGuard)
@ApiTags('file-shares')
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
  @ApiOperation({ summary: 'Create a sharable link for a file.' })
  @ApiParam({ name: 'id', description: 'Identifier of the file to share.' })
  @ApiCreatedResponse({ type: FileShareResponseDto })
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
  @ApiOperation({ summary: 'List active share links for a file.' })
  @ApiParam({
    name: 'id',
    description: 'Identifier of the file to list shares for.',
  })
  @ApiOkResponse({ type: FileShareResponseDto, isArray: true })
  async listShares(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<FileShareResponseDto[]> {
    const userId = this.extractUserId(request);
    return this.fileShareService.listShares(userId, fileId);
  }

  @Version('1')
  @Delete(':id/shares/:shareId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a share link.' })
  @ApiParam({
    name: 'id',
    description: 'Identifier of the file that owns the share.',
  })
  @ApiParam({
    name: 'shareId',
    description: 'Identifier of the share to revoke.',
  })
  @ApiNoContentResponse({ description: 'Share was revoked successfully.' })
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send a share link to a recipient via email.' })
  @ApiParam({ name: 'id', description: 'Identifier of the shared file.' })
  @ApiNoContentResponse({ description: 'Email sent successfully.' })
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
@ApiTags('file-share-public')
export class PublicFileShareController {
  constructor(private readonly fileShareService: FileShareService) {}

  @Version('1')
  @Get(':shareToken')
  @ApiOperation({
    summary: 'Retrieve metadata and download link for a shared file.',
  })
  @ApiParam({
    name: 'shareToken',
    description: 'Token that identifies the share link.',
  })
  @ApiOkResponse({ type: PublicFileShareResponseDto })
  async resolveShare(
    @Param('shareToken') shareToken: string,
  ): Promise<PublicFileShareResponseDto> {
    return this.fileShareService.getShareByToken(shareToken);
  }
}
