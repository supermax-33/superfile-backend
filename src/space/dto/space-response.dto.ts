export class SpaceLogoResponseDto {
  constructor(partial: Partial<SpaceLogoResponseDto> = {}) {
    Object.assign(this, partial);
  }

  contentType: string | null = null;
  hash: string | null = null;
}

export class SpaceResponseDto {
  constructor(partial: Partial<SpaceResponseDto> = {}) {
    Object.assign(this, partial);
  }

  id!: string;
  slug!: string;
  name!: string;
  ownerId!: string;
  vectorStoreId: string | null = null;
  createdAt!: Date;
  updatedAt!: Date;
  logo: SpaceLogoResponseDto | null = null;
}
