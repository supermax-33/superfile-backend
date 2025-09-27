import { ApiProperty } from '@nestjs/swagger';

export class FileProgressResponseDto {
  constructor(partial: Partial<FileProgressResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Identifier of the file.' })
  id!: string;

  @ApiProperty({
    description: 'Upload progress percentage from 0 to 100.',
    minimum: 0,
    maximum: 100,
    example: 75,
  })
  percent!: number;

  @ApiProperty({
    description: 'Total bytes transferred to S3 so far.',
    example: 5242880,
  })
  bytesTransferred!: number;

  @ApiProperty({
    description: 'Total bytes expected for the upload.',
    example: 10485760,
  })
  bytesTotal!: number;

  @ApiProperty({
    description: 'Indicates whether the upload is still in progress.',
    example: true,
  })
  isUploading!: boolean;

  @ApiProperty({
    description: 'Timestamp when the upload started.',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  startedAt: Date | null = null;

  @ApiProperty({
    description: 'Timestamp when the upload progress was last updated.',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  updatedAt: Date | null = null;
}
