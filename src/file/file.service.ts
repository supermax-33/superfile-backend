import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import { File, FileStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileResponseDto } from './dto/file-response.dto';
import { FileNoteResponseDto } from './dto/file-note-response.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { S3FileStorageService } from './s3-file-storage.service';
import { FileProgressService } from './file-progress.service';
import { OpenAiVectorStoreService } from './openai-vector-store.service';
import { FileProgressResponseDto } from './dto/file-progress-response.dto';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  VECTOR_STORE_NAME_PREFIX,
} from 'config';
import { buildS3Key, formatError, normalizeName } from 'utils/helpers';

@Injectable()
export class FileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3FileStorageService,
    private readonly progress: FileProgressService,
    private readonly openAi: OpenAiVectorStoreService,
  ) {}

  async uploadFiles(
    userId: string,
    spaceId: string,
    files: Express.Multer.File[],
    note?: string | null,
  ): Promise<FileResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file must be provided.');
    }

    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { ownerId: true },
    });

    if (!space) {
      throw new NotFoundException('Space not found.');
    }

    if (space.ownerId !== userId) {
      throw new ForbiddenException('You do not own the target space.');
    }

    const vectorStoreId = await this.resolveVectorStoreId(userId);

    const responses: FileResponseDto[] = [];

    for (const file of files) {
      this.assertFileValid(file);

      const s3Key = buildS3Key(spaceId, file.originalname);

      const record = await this.prisma.file.create({
        data: {
          spaceId,
          userId,
          filename: normalizeName(file.originalname),
          mimetype: file.mimetype,
          size: BigInt(file.size),
          status: FileStatus.PROCESSING,
          s3Key,
          vectorStoreId,
          openAiFileId: null,
          error: null,
          note: note ?? null,
        },
      });

      this.progress.start(record.id, file.size);

      try {
        await this.storage.upload({
          key: s3Key,
          body: this.asReadable(file),
          contentType: file.mimetype,
          contentLength: file.size,
          onProgress: (loaded, total) => {
            this.progress.update(record.id, loaded, total);
          },
        });
        this.progress.complete(record.id);
      } catch (error) {
        this.progress.fail(record.id);
        await this.storage
          .delete(s3Key)
          .catch(() => undefined /* best effort cleanup */);

        const updated = await this.prisma.file.update({
          where: { id: record.id },
          data: {
            status: FileStatus.FAILED,
            error: formatError('Failed to upload file to storage', error),
          },
        });

        responses.push(this.toFileResponse(updated));
        continue;
      }

      try {
        const uploadResult = await this.openAi.uploadFile(vectorStoreId, {
          buffer: this.ensureBuffer(file),
          filename: normalizeName(file.originalname),
          mimetype: file.mimetype,
        });

        const status = this.mapOpenAiStatus(uploadResult.status);

        const updated = await this.prisma.file.update({
          where: { id: record.id },
          data: {
            status,
            openAiFileId: uploadResult.fileId,
            vectorStoreId,
            error: uploadResult.lastError ?? null,
          },
        });

        responses.push(this.toFileResponse(updated));
      } catch (error) {
        const updated = await this.prisma.file.update({
          where: { id: record.id },
          data: {
            status: FileStatus.FAILED,
            error: formatError(
              'Failed to ingest file with OpenAI File Search',
              error,
            ),
          },
        });

        responses.push(this.toFileResponse(updated));
      }
    }

    return responses;
  }

  async listFiles(
    userId: string,
    query: ListFilesQueryDto,
  ): Promise<FileResponseDto[]> {
    const files = await this.prisma.file.findMany({
      where: {
        space: {
          ownerId: userId,
          ...(query.spaceId ? { id: query.spaceId } : {}),
        },
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return files.map((file) => this.toFileResponse(file));
  }

  async getNote(fileId: string, userId: string): Promise<FileNoteResponseDto> {
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        space: { ownerId: userId },
      },
      select: { note: true },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    return new FileNoteResponseDto({ note: file.note ?? null });
  }

  async updateNote(
    fileId: string,
    userId: string,
    note: string,
  ): Promise<FileNoteResponseDto> {
    const existing = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        space: { ownerId: userId },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('File not found.');
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { note },
      select: { note: true },
    });

    return new FileNoteResponseDto({ note: updated.note ?? null });
  }

  async clearNote(fileId: string, userId: string): Promise<void> {
    const existing = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        space: { ownerId: userId },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('File not found.');
    }

    await this.prisma.file.update({
      where: { id: fileId },
      data: { note: null },
    });
  }

  async getUploadProgress(
    fileId: string,
    userId: string,
  ): Promise<FileProgressResponseDto> {
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        space: { ownerId: userId },
      },
      select: {
        size: true,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    const snapshot = this.progress.getSnapshot(fileId);

    if (!snapshot) {
      const size = Number(file.size);
      return new FileProgressResponseDto({
        id: fileId,
        percent: 100,
        bytesTransferred: size,
        bytesTotal: size,
        isUploading: false,
        startedAt: null,
        updatedAt: null,
      });
    }

    return new FileProgressResponseDto({
      id: snapshot.fileId,
      percent: snapshot.percent,
      bytesTransferred: snapshot.bytesTransferred,
      bytesTotal: snapshot.bytesTotal,
      isUploading: true,
      startedAt: snapshot.startedAt,
      updatedAt: snapshot.updatedAt,
    });
  }

  async downloadFile(
    fileId: string,
    userId: string,
  ): Promise<{
    stream: Readable;
    filename: string;
    contentType: string;
    contentLength?: number;
  }> {
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        space: { ownerId: userId },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    const download = await this.storage.download(file.s3Key);

    return {
      stream: download.stream,
      filename: file.filename,
      contentType: download.contentType ?? file.mimetype,
      contentLength: download.contentLength ?? Number(file.size),
    };
  }

  async refreshStatus(
    fileId: string,
    userId: string,
  ): Promise<FileResponseDto> {
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        space: { ownerId: userId },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    if (!file.vectorStoreId || !file.openAiFileId) {
      throw new BadRequestException('File has not been ingested yet.');
    }

    const statusResult = await this.openAi.getFileStatus(
      file.vectorStoreId,
      file.openAiFileId,
    );

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: this.mapOpenAiStatus(statusResult.status),
        error: statusResult.lastError ?? null,
      },
    });

    return this.toFileResponse(updated);
  }

  async remove(fileId: string, userId: string): Promise<void> {
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        space: { ownerId: userId },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    try {
      await this.storage.delete(file.s3Key);
    } catch (error) {
      throw new InternalServerErrorException(
        formatError('Failed to delete file from storage', error),
      );
    }

    if (file.vectorStoreId && file.openAiFileId) {
      try {
        await this.openAi.deleteFile(file.vectorStoreId, file.openAiFileId);
      } catch (error) {
        throw new InternalServerErrorException(
          formatError('Failed to delete file from OpenAI vector store', error),
        );
      }
    }

    await this.prisma.file.delete({ where: { id: fileId } });
  }

  async getFileOwnerId(fileId: string): Promise<string | null> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { space: { select: { ownerId: true } } },
    });

    return file?.space.ownerId ?? null;
  }

  private toFileResponse(file: File): FileResponseDto {
    return new FileResponseDto({
      id: file.id,
      spaceId: file.spaceId,
      userId: file.userId,
      filename: file.filename,
      mimetype: file.mimetype,
      size: Number(file.size),
      status: file.status,
      s3Key: file.s3Key,
      vectorStoreId: file.vectorStoreId ?? null,
      openAiFileId: file.openAiFileId ?? null,
      error: file.error ?? null,
      note: file.note ?? null,
      uploadedAt: file.uploadedAt,
      updatedAt: file.updatedAt,
    });
  }

  private mapOpenAiStatus(status: string | null | undefined): FileStatus {
    switch (status) {
      case 'completed':
        return FileStatus.SUCCESS;
      case 'in_progress':
      case 'queued':
        return FileStatus.PROCESSING;
      case 'failed':
      default:
        return FileStatus.FAILED;
    }
  }

  private assertFileValid(file: Express.Multer.File): void {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type for ${file.originalname}. Allowed file types: ${ALLOWED_MIME_TYPES.join(
          ', ',
        )}`,
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `${file.originalname} exceeds the maximum size of ${MAX_FILE_SIZE_BYTES} bytes.`,
      );
    }
  }

  private asReadable(file: Express.Multer.File): Readable {
    if (file.buffer) {
      return Readable.from(file.buffer);
    }

    if (file.stream instanceof Readable) {
      return file.stream;
    }

    throw new InternalServerErrorException('Unable to access file stream.');
  }

  private ensureBuffer(file: Express.Multer.File): Buffer {
    if (file.buffer) {
      return file.buffer;
    }

    throw new InternalServerErrorException(
      'File buffer is required for OpenAI ingestion.',
    );
  }

  private async resolveVectorStoreId(userId: string): Promise<string> {
    const existing = await this.prisma.file.findFirst({
      where: { userId, vectorStoreId: { not: null } },
      orderBy: { uploadedAt: 'desc' },
      select: { vectorStoreId: true },
    });

    if (existing?.vectorStoreId) {
      return existing.vectorStoreId;
    }

    const name = `${VECTOR_STORE_NAME_PREFIX}-${userId}`;
    return this.openAi.createVectorStore(name);
  }
}
