import { ApiProperty } from '@nestjs/swagger';

export class PublicFileShareResponseDto {
  constructor(partial: Partial<PublicFileShareResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Unique identifier of the share.' })
  id!: string;

  @ApiProperty({ description: 'Identifier of the shared file.' })
  fileId!: string;

  @ApiProperty({ description: 'Identifier of the space that owns the file.' })
  spaceId!: string;

  @ApiProperty({
    description: 'Token recipients must use to access the share.',
  })
  shareToken!: string;

  @ApiProperty({ description: 'Name of the shared file.' })
  filename!: string;

  @ApiProperty({ description: 'MIME type of the shared file.' })
  mimetype!: string;

  @ApiProperty({ description: 'Size of the shared file in bytes.' })
  size!: number;

  @ApiProperty({
    description: 'Presigned URL that can be used to download the file.',
  })
  url!: string;

  @ApiProperty({
    description:
      'Optional note included with the share to explain its context to recipients.',
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
