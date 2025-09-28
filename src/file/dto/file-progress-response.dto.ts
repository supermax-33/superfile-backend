export class FileProgressResponseDto {
  constructor(partial: Partial<FileProgressResponseDto> = {}) {
    Object.assign(this, partial);
  }

  id!: string;
  percent!: number;
  bytesTransferred!: number;
  bytesTotal!: number;
  isUploading!: boolean;
  startedAt: Date | null = null;
  updatedAt: Date | null = null;
}
