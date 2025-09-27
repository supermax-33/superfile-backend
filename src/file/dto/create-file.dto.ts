import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFileDto {
  @ApiProperty({
    description: 'Identifier of the space the file belongs to.',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @IsUUID()
  spaceId!: string;

  @ApiProperty({
    description: 'Original name of the uploaded file.',
    example: 'project-overview.pdf',
    maxLength: 1024,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  filename!: string;

  @ApiProperty({
    description: 'MIME type describing the file content.',
    example: 'application/pdf',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mimetype!: string;

  @ApiProperty({
    description: 'Size of the file in bytes.',
    example: 1048576,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  size!: number;

  @ApiProperty({
    description: 'Storage key referencing the file within S3.',
    example:
      'spaces/3b241101-e2bb-4255-8caf-4136c566a962/files/project-overview.pdf',
    maxLength: 2048,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  s3Key!: string;

  @ApiPropertyOptional({
    description: 'Processing status of the file. Defaults to processing.',
    enum: FileStatus,
  })
  @IsOptional()
  @IsEnum(FileStatus)
  status?: FileStatus;

  @ApiPropertyOptional({
    description:
      'Identifier of the backing vector store record, when available.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  vectorStoreId?: string | null;

  @ApiPropertyOptional({
    description:
      'OpenAI file identifier if the file was forwarded to OpenAI APIs.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  openAiFileId?: string | null;

  @ApiPropertyOptional({
    description:
      'Last processing error message, when the file failed to process.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  error?: string | null;
}
