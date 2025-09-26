import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { File, FileStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFileDto } from './dto/create-file.dto';
import { FileResponseDto } from './dto/file-response.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { UpdateFileDto } from './dto/update-file.dto';

@Injectable()
export class FileService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFileDto): Promise<FileResponseDto> {
    const filename = dto.filename.trim();
    if (!filename) {
      throw new BadRequestException('Filename cannot be empty.');
    }

    const mimetype = dto.mimetype.trim();
    if (!mimetype) {
      throw new BadRequestException('MIME type cannot be empty.');
    }

    const s3Key = dto.s3Key.trim();
    if (!s3Key) {
      throw new BadRequestException('S3 key cannot be empty.');
    }

    const space = await this.prisma.space.findUnique({
      where: { id: dto.spaceId },
      select: { ownerId: true },
    });

    if (!space) {
      throw new NotFoundException('Space not found.');
    }

    if (space.ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to create files in this space.',
      );
    }

    const file = await this.prisma.file.create({
      data: {
        spaceId: dto.spaceId,
        userId: space.ownerId,
        filename,
        mimetype,
        size: BigInt(dto.size),
        status: dto.status ?? FileStatus.PROCESSING,
        s3Key,
        vectorStoreId: dto.vectorStoreId ?? null,
        openAiFileId: dto.openAiFileId ?? null,
        error: dto.error ?? null,
      },
    });

    return this.toFileResponse(file);
  }

  async findAll(
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

  async findOne(fileId: string, userId: string): Promise<FileResponseDto> {
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        space: { ownerId: userId },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    return this.toFileResponse(file);
  }

  async update(
    fileId: string,
    userId: string,
    dto: UpdateFileDto,
  ): Promise<FileResponseDto> {
    await this.ensureUserOwnsFile(fileId, userId);

    const data: Prisma.FileUpdateInput = {};

    if (dto.filename !== undefined) {
      const trimmed = dto.filename.trim();
      if (!trimmed) {
        throw new BadRequestException('Filename cannot be empty.');
      }
      data.filename = trimmed;
    }

    if (dto.mimetype !== undefined) {
      const trimmed = dto.mimetype.trim();
      if (!trimmed) {
        throw new BadRequestException('MIME type cannot be empty.');
      }
      data.mimetype = trimmed;
    }

    if (dto.size !== undefined) {
      data.size = BigInt(dto.size);
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (dto.s3Key !== undefined) {
      const trimmed = dto.s3Key.trim();
      if (!trimmed) {
        throw new BadRequestException('S3 key cannot be empty.');
      }
      data.s3Key = trimmed;
    }

    if (dto.vectorStoreId !== undefined) {
      data.vectorStoreId = dto.vectorStoreId ?? null;
    }

    if (dto.openAiFileId !== undefined) {
      data.openAiFileId = dto.openAiFileId ?? null;
    }

    if (dto.error !== undefined) {
      data.error = dto.error ?? null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'At least one field must be provided to update the file.',
      );
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data,
    });

    return this.toFileResponse(updated);
  }

  async remove(fileId: string, userId: string): Promise<void> {
    await this.ensureUserOwnsFile(fileId, userId);
    await this.prisma.file.delete({ where: { id: fileId } });
  }

  async getOwnerId(fileId: string): Promise<string | null> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { space: { select: { ownerId: true } } },
    });

    return file?.space.ownerId ?? null;
  }

  private async ensureUserOwnsFile(
    fileId: string,
    userId: string,
  ): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { space: { select: { ownerId: true } } },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    if (file.space.ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this file.',
      );
    }
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
      uploadedAt: file.uploadedAt,
      updatedAt: file.updatedAt,
    });
  }
}
