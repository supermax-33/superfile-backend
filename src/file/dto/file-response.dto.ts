import { ApiProperty } from '@nestjs/swagger';
import { FileStatus } from '@prisma/client';

export class FileResponseDto {
  constructor(partial: Partial<FileResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({
    description: 'Unique identifier of the file.',
    example: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
  })
  id!: string;

  @ApiProperty({
    description: 'Identifier of the space associated with the file.',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  spaceId!: string;

  @ApiProperty({
    description: 'Identifier of the user that owns the file.',
    example: '5c58c61d-07d4-4fb5-8d7a-ef63fd71dbb5',
  })
  userId!: string;

  @ApiProperty({
    description: 'Original name of the uploaded file.',
    example: 'project-overview.pdf',
  })
  filename!: string;

  @ApiProperty({
    description: 'MIME type describing the file content.',
    example: 'application/pdf',
  })
  mimetype!: string;

  @ApiProperty({
    description: 'Size of the file in bytes.',
    example: 1048576,
  })
  size!: number;

  @ApiProperty({
    description: 'Processing status of the file.',
    enum: FileStatus,
    example: FileStatus.PROCESSING,
  })
  status!: FileStatus;

  @ApiProperty({
    description: 'Storage key referencing the file within S3.',
    example:
      'spaces/3b241101-e2bb-4255-8caf-4136c566a962/files/project-overview.pdf',
  })
  s3Key!: string;

  @ApiProperty({
    description:
      'Identifier of the backing vector store record, when available.',
    nullable: true,
    example: null,
  })
  vectorStoreId: string | null = null;

  @ApiProperty({
    description:
      'OpenAI file identifier if the file was forwarded to OpenAI APIs.',
    nullable: true,
    example: null,
  })
  openAiFileId: string | null = null;

  @ApiProperty({
    description:
      'Last processing error message, when the file failed to process.',
    nullable: true,
    example: null,
  })
  error: string | null = null;

  @ApiProperty({
    description: 'Timestamp when the file was uploaded to the system.',
    type: String,
    format: 'date-time',
  })
  uploadedAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the file metadata was last updated.',
    type: String,
    format: 'date-time',
  })
  updatedAt!: Date;
}
