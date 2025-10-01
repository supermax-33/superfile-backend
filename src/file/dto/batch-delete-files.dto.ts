import {
  ArrayNotEmpty,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchDeleteFilesDto {
  constructor(partial: Partial<BatchDeleteFilesDto> = {}) {
    Object.assign(this, partial);
  }

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  fileIds!: string[];
}

export class BatchDeleteFailureDto {
  constructor(partial: Partial<BatchDeleteFailureDto> = {}) {
    Object.assign(this, partial);
  }

  fileId!: string;
  error!: string;
}

export class BatchDeleteFilesResponseDto {
  constructor(partial: Partial<BatchDeleteFilesResponseDto> = {}) {
    Object.assign(this, partial);
  }
  deleted: string[] = [];

  @ValidateNested({ each: true })
  @Type(() => BatchDeleteFailureDto)
  failed: BatchDeleteFailureDto[] = [];
}
