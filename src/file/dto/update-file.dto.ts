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
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  filename?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimetype?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;

  @IsOptional()
  @IsEnum(FileStatus)
  status?: FileStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  s3Key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  vectorStoreId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  openAiFileId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  error?: string | null;
}
