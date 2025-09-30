import { FileStatus } from '@prisma/client';

export class FileResponseDto {
  constructor(partial: Partial<FileResponseDto> = {}) {
    Object.assign(this, partial);
  }

  id!: string;
  spaceId!: string;
  filename!: string;
  mimetype!: string;
  size!: number;
  status!: FileStatus;
  s3Key!: string;
  vectorStoreId: string | null = null;
  openAiFileId: string | null = null;
  error: string | null = null;
  note: string | null = null;
  uploadedAt!: Date;
  updatedAt!: Date;
}
