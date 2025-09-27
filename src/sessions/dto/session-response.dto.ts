import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ description: 'Unique identifier for the session.' })
  id: string;

  @ApiProperty({
    description: 'IP address captured when the session was last used.',
    required: false,
  })
  ipAddress?: string | null;

  @ApiProperty({
    description: 'User agent string associated with the client.',
    required: false,
  })
  userAgent?: string | null;

  @ApiProperty({ description: 'Timestamp for when the session was created.' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp for when the session was last used.' })
  lastUsedAt: Date;

  @ApiProperty({ description: 'Timestamp for when the session expires.' })
  expiresAt: Date;
}
