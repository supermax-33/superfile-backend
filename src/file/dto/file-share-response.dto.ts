export class FileShareResponseDto {
  constructor(partial: Partial<FileShareResponseDto> = {}) {
    Object.assign(this, partial);
  }

  id!: string;
  fileId!: string;
  spaceId!: string;
  shareToken!: string;
  url!: string;
  note: string | null = null;
  expiresAt: Date | null = null;
  createdAt!: Date;
}
