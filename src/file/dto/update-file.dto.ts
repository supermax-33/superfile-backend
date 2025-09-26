import { ApiPropertyOptional } from '@nestjs/swagger';
import { FileStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateFileDto {
  @ApiPropertyOptional({
    description: 'Updated file name to display to users.',
    maxLength: 1024,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  filename?: string;

  @ApiPropertyOptional({
    description: 'Updated MIME type describing the file.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimetype?: string;

  @ApiPropertyOptional({
    description: 'Updated file size in bytes.',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;

  @ApiPropertyOptional({
    description: 'Processing status of the file.',
    enum: FileStatus,
  })
  @IsOptional()
  @IsEnum(FileStatus)
  status?: FileStatus;

  @ApiPropertyOptional({
    description: 'Updated storage key referencing the file within S3.',
    maxLength: 2048,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  s3Key?: string;

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
