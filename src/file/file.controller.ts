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
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileResponseDto } from './dto/file-response.dto';
import { FileNoteResponseDto } from './dto/file-note-response.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { FileOwnerGuard } from './guards/file-owner.guard';
import { FileService } from './file.service';
import { UploadFilesDto } from './dto/upload-files.dto';
import { RequestWithUser } from 'types';
import { FileProgressResponseDto } from './dto/file-progress-response.dto';
import { UpdateFileNoteDto } from './dto/update-file-note.dto';
import {
  BatchDeleteFilesDto,
  BatchDeleteFilesResponseDto,
} from './dto/batch-delete-files.dto';
import {
  BatchDownloadFilesDto,
  BatchDownloadFilesResponseDto,
} from './dto/batch-download-files.dto';
import {
  ALLOWED_MIME_TYPES,
  FILE_UPLOAD_FIELD,
  MAX_FILE_SIZE_BYTES,
} from 'config';

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
        `Unsupported file type: ${file.mimetype}. Allowed file types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      ),
      false,
    );
  },
});
@Controller('files')
@UseFilters(JwtExceptionFilter)
@UseGuards(JwtAuthGuard)
@ApiTags('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  private extractUserId(request: RequestWithUser): string {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User context is required.');
    }
    return userId;
  }

  @Version('1')
  @Post()
  @UseInterceptors(uploadInterceptor)
  async upload(
    @Req() request: RequestWithUser,
    @Body() body: UploadFilesDto,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<FileResponseDto[]> {
    const userId = this.extractUserId(request);

    return this.fileService.uploadFiles(
      userId,
      body.spaceId,
      files,
      body.note ?? null,
    );
  }

  @Version('1')
  @Get()
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
  @Get(':id/note')
  @UseGuards(FileOwnerGuard)
  async getNote(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<FileNoteResponseDto> {
    const userId = this.extractUserId(request);
    return this.fileService.getNote(fileId, userId);
  }

  @Version('1')
  @Patch(':id/note')
  @UseGuards(FileOwnerGuard)
  async updateNote(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
    @Body() body: UpdateFileNoteDto,
  ): Promise<FileNoteResponseDto> {
    const userId = this.extractUserId(request);
    return this.fileService.updateNote(fileId, userId, body.note);
  }

  @Version('1')
  @Delete(':id/note')
  @UseGuards(FileOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNote(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<void> {
    const userId = this.extractUserId(request);
    await this.fileService.clearNote(fileId, userId);
  }

  @Version('1')
  @Get(':id/progress')
  @UseGuards(FileOwnerGuard)
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
  async refreshStatus(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<FileResponseDto> {
    const userId = this.extractUserId(request);
    return this.fileService.refreshStatus(fileId, userId);
  }

  @Version('1')
  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete multiple files.' })
  @ApiResponse({ status: HttpStatus.OK, type: BatchDeleteFilesResponseDto })
  async removeMany(
    @Req() request: RequestWithUser,
    @Body() body: BatchDeleteFilesDto,
  ): Promise<BatchDeleteFilesResponseDto> {
    const userId = this.extractUserId(request);
    return this.fileService.removeMany(userId, body.fileIds);
  }

  @Version('1')
  @Post('download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate download URLs for multiple files.' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: BatchDownloadFilesResponseDto,
  })
  async downloadMany(
    @Req() request: RequestWithUser,
    @Body() body: BatchDownloadFilesDto,
  ): Promise<BatchDownloadFilesResponseDto> {
    const userId = this.extractUserId(request);
    return this.fileService.generateDownloadUrls(userId, body.fileIds);
  }

  @Version('1')
  @Delete(':id')
  @UseGuards(FileOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<void> {
    const userId = this.extractUserId(request);
    await this.fileService.remove(fileId, userId);
  }
}
