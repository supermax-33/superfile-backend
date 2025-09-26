import { ApiProperty } from '@nestjs/swagger';

export class SpaceLogoResponseDto {
  constructor(partial: Partial<SpaceLogoResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({
    description: 'MIME type of the stored logo image.',
    example: 'image/png',
    nullable: true,
  })
  contentType: string | null = null;

  @ApiProperty({
    description:
      'SHA-256 hash of the stored logo data, useful for cache validation.',
    example: '3d2e6c9a4cbb4a2e83b8f19e2ea1e148aef3791cbdc02fc7727f1b95ef5c1f0a',
    nullable: true,
  })
  hash: string | null = null;
}

export class SpaceResponseDto {
  constructor(partial: Partial<SpaceResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({
    description: 'Unique identifier of the space.',
    example: 'ddeb27fb-d9a0-4624-be4d-4615062daed4',
  })
  id!: string;

  @ApiProperty({
    description: 'Slug used in URLs to reference the space.',
    example: 'product-team',
  })
  slug!: string;

  @ApiProperty({
    description: 'Display name of the space.',
    example: 'Product Team',
  })
  name!: string;

  @ApiProperty({
    description: 'Identifier of the user that owns the space.',
    example: '0e3f5fbf-3a9e-4f1f-b7d6-9b9ec16d7056',
  })
  ownerId!: string;

  @ApiProperty({
    description: 'Timestamp when the space was first created.',
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the space was last updated.',
    type: String,
    format: 'date-time',
  })
  updatedAt!: Date;

  @ApiProperty({
    description:
      'Logo metadata for the space. Null when a logo has not been uploaded yet.',
    type: () => SpaceLogoResponseDto,
    nullable: true,
  })
  logo: SpaceLogoResponseDto | null = null;
}
