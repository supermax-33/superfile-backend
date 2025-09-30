import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({
    type: [String],
    description: 'Identifiers of the files to delete.',
    example: ['1c01aa37-66d7-47f1-8e43-fb2eb742df26'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  fileIds!: string[];
}

export class BatchDeleteFailureDto {
  constructor(partial: Partial<BatchDeleteFailureDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({
    description: 'Identifier of the file that could not be deleted.',
  })
  fileId!: string;

  @ApiProperty({
    description: 'Human-readable reason describing why the deletion failed.',
  })
  error!: string;
}

export class BatchDeleteFilesResponseDto {
  constructor(partial: Partial<BatchDeleteFilesResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({
    type: [String],
    description: 'File identifiers that were deleted successfully.',
    example: ['1c01aa37-66d7-47f1-8e43-fb2eb742df26'],
  })
  deleted: string[] = [];

  @ApiProperty({
    type: [BatchDeleteFailureDto],
    description: 'Information about file deletions that failed.',
    example: [
      {
        fileId: '8c73ef8b-2dd7-4adb-83f3-4c42111dbf3c',
        error: 'File not found or access denied.',
      },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => BatchDeleteFailureDto)
  failed: BatchDeleteFailureDto[] = [];
}
