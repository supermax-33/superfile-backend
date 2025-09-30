import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({
    type: [String],
    description: 'Identifiers of the files to download.',
    example: ['9baf04e1-4362-4d71-9a58-2be10b6ec992'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  fileIds!: string[];
}

export class BatchDownloadFileItemDto {
  constructor(partial: Partial<BatchDownloadFileItemDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Identifier of the file.' })
  @IsUUID('4')
  fileId!: string;

  @ApiProperty({ description: 'Original filename for the file.' })
  @IsString()
  filename!: string;

  @ApiProperty({ description: 'MIME type recorded for the file.' })
  @IsString()
  mimetype!: string;

  @ApiProperty({ description: 'File size in bytes.' })
  @IsNumber()
  size!: number;

  @ApiProperty({
    description: 'Short-lived URL clients can use to download the file.',
  })
  @IsUrl()
  downloadUrl!: string;
}

export class BatchDownloadFilesResponseDto {
  constructor(partial: Partial<BatchDownloadFilesResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({ type: [BatchDownloadFileItemDto] })
  @ValidateNested({ each: true })
  @Type(() => BatchDownloadFileItemDto)
  files: BatchDownloadFileItemDto[] = [];
}
