import { FileStatus } from '@prisma/client';

export class ReminderFileResponseDto {
  constructor(partial: Partial<ReminderFileResponseDto> = {}) {
    Object.assign(this, partial);
  }

  id!: string;
  spaceId!: string;
  userId!: string;
  filename!: string;
  mimetype!: string;
  size!: number;
  status!: FileStatus;
  uploadedAt!: Date;
  updatedAt!: Date;
}
