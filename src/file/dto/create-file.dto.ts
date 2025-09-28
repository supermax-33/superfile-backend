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
  @IsUUID()
  spaceId!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  filename!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mimetype!: string;

  @IsInt()
  @Min(0)
  size!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  s3Key!: string;

  @IsOptional()
  @IsEnum(FileStatus)
  status?: FileStatus;

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
