import { ApiProperty } from '@nestjs/swagger';
import { FileStatus } from '@prisma/client';

export class FileResponseDto {
  constructor(partial: Partial<FileResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id!: string;

  @ApiProperty()
  spaceId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  filename!: string;

  @ApiProperty()
  mimetype!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty({ enum: FileStatus })
  status!: FileStatus;

  @ApiProperty()
  s3Key!: string;

  @ApiProperty({ nullable: true })
  vectorStoreId: string | null = null;

  @ApiProperty({ nullable: true })
  openAiFileId: string | null = null;

  @ApiProperty({ nullable: true })
  error: string | null = null;

  @ApiProperty()
  uploadedAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
