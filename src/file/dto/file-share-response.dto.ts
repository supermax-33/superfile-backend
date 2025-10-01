import { ApiProperty } from '@nestjs/swagger';

export class FileShareResponseDto {
  constructor(partial: Partial<FileShareResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Unique identifier for the share link.' })
  id!: string;

  @ApiProperty({ description: 'Identifier of the shared file.' })
  fileId!: string;

  @ApiProperty({ description: 'Identifier of the space that owns the file.' })
  spaceId!: string;

  @ApiProperty({ description: 'Token used to access the share link.' })
  shareToken!: string;

  @ApiProperty({
    description: 'Public URL that recipients can use to access the file.',
  })
  url!: string;

  @ApiProperty({
    description:
      'Optional note provided with the share to describe its purpose for recipients.',
    nullable: true,
  })
  note: string | null = null;

  @ApiProperty({
    description:
      'Date and time when the share expires. Null means it does not expire.',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  expiresAt: Date | null = null;

  @ApiProperty({
    description: 'Date and time when the share was created.',
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;
}
