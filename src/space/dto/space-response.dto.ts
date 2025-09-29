import { ApiProperty } from '@nestjs/swagger';

export class SpaceLogoResponseDto {
  constructor(partial: Partial<SpaceLogoResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty({ nullable: true })
  contentType: string | null = null;

  @ApiProperty({ nullable: true })
  hash: string | null = null;
}

export class SpaceResponseDto {
  constructor(partial: Partial<SpaceResponseDto> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty({ nullable: true })
  vectorStoreId: string | null = null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: () => SpaceLogoResponseDto, nullable: true })
  logo: SpaceLogoResponseDto | null = null;
}
