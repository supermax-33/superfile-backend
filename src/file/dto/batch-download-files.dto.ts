import {
  ArrayNotEmpty,
  IsArray,
  IsUUID,
  ValidateNested,
  IsNumber,
  IsString,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchDownloadFilesDto {
  constructor(partial: Partial<BatchDownloadFilesDto> = {}) {
    Object.assign(this, partial);
  }

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  fileIds!: string[];
}

export class BatchDownloadFileItemDto {
  constructor(partial: Partial<BatchDownloadFileItemDto> = {}) {
    Object.assign(this, partial);
  }

  @IsUUID('4')
  fileId!: string;

  @IsString()
  filename!: string;

  @IsString()
  mimetype!: string;

  @IsNumber()
  size!: number;

  @IsUrl()
  downloadUrl!: string;
}

export class BatchDownloadFilesResponseDto {
  constructor(partial: Partial<BatchDownloadFilesResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ValidateNested({ each: true })
  @Type(() => BatchDownloadFileItemDto)
  files: BatchDownloadFileItemDto[] = [];
}
