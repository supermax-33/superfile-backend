export class PublicFileShareResponseDto {
  constructor(partial: Partial<PublicFileShareResponseDto> = {}) {
    Object.assign(this, partial);
  }

  id!: string;
  fileId!: string;
  spaceId!: string;
  shareToken!: string;
  filename!: string;
  mimetype!: string;
  size!: number;
  url!: string;
  note: string | null = null;
  expiresAt: Date | null = null;
  createdAt!: Date;
}
