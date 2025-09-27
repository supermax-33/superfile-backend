import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
  Version,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';
import { FileResponseDto } from './dto/file-response.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { FileOwnerGuard } from './guards/file-owner.guard';
import { FileService } from './file.service';
import { UploadFilesDto } from './dto/upload-files.dto';
import {
  ALLOWED_MIME_TYPES,
  FILE_UPLOAD_FIELD,
  MAX_FILE_SIZE_BYTES,
} from './file.constants';
import { FileProgressResponseDto } from './dto/file-progress-response.dto';
import { RequestWithUser } from 'types';

const uploadInterceptor = FilesInterceptor(FILE_UPLOAD_FIELD, undefined, {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      new BadRequestException(
        `Unsupported MIME type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      ),
      false,
    );
  },
});

@ApiTags('files')
@Controller('files')
@UseFilters(JwtExceptionFilter)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Version('1')
  @Post()
  @UseInterceptors(uploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload one or more PDF files to a user-owned space.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        spaceId: { type: 'string', format: 'uuid' },
        [FILE_UPLOAD_FIELD]: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['spaceId', FILE_UPLOAD_FIELD],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Files uploaded successfully.',
    type: FileResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Invalid payload or files.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async upload(
    @Req() request: RequestWithUser,
    @Body() body: UploadFilesDto,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<FileResponseDto[]> {
    const userId = this.extractUserId(request);

    return this.fileService.uploadFiles(userId, body.spaceId, files);
  }

  @Version('1')
  @Get()
  @ApiOperation({
    summary: 'List files owned by the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of files retrieved successfully.',
    type: FileResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async list(
    @Query() query: ListFilesQueryDto,
    @Req() request: RequestWithUser,
  ): Promise<FileResponseDto[]> {
    const userId = this.extractUserId(request);
    return this.fileService.listFiles(userId, query);
  }

  @Version('1')
  @Get(':id')
  @UseGuards(FileOwnerGuard)
  @ApiOperation({ summary: 'Download a file from S3.' })
  @ApiResponse({ status: 200, description: 'File downloaded successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'File not found.' })
  async download(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const userId = this.extractUserId(request);
    const result = await this.fileService.downloadFile(fileId, userId);

    response.setHeader(
      'Content-Type',
      result.contentType ?? 'application/octet-stream',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}"`,
    );
    if (result.contentLength) {
      response.setHeader('Content-Length', result.contentLength.toString());
    }

    return new StreamableFile(result.stream);
  }

  @Version('1')
  @Get(':id/progress')
  @UseGuards(FileOwnerGuard)
  @ApiOperation({ summary: 'Retrieve the current upload progress for a file.' })
  @ApiResponse({
    status: 200,
    description: 'Upload progress retrieved successfully.',
    type: FileProgressResponseDto,
  })
  async progress(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<FileProgressResponseDto> {
    const userId = this.extractUserId(request);
    return this.fileService.getUploadProgress(fileId, userId);
  }

  @Version('1')
  @Patch(':id/status')
  @UseGuards(FileOwnerGuard)
  @ApiOperation({ summary: 'Refresh OpenAI ingestion status for a file.' })
  @ApiResponse({
    status: 200,
    description: 'File status refreshed successfully.',
    type: FileResponseDto,
  })
  async refreshStatus(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<FileResponseDto> {
    const userId = this.extractUserId(request);
    return this.fileService.refreshStatus(fileId, userId);
  }

  @Version('1')
  @Delete(':id')
  @UseGuards(FileOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file from storage and OpenAI.' })
  @ApiResponse({ status: 204, description: 'File deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'File not found.' })
  async remove(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<void> {
    const userId = this.extractUserId(request);
    await this.fileService.remove(fileId, userId);
  }

  private extractUserId(request: RequestWithUser): string {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User context is required.');
    }
    return userId;
  }
}
