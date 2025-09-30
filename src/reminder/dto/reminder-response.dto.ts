import { ReminderFileResponseDto } from './reminder-file-response.dto';

export class ReminderResponseDto {
  constructor(partial: Partial<ReminderResponseDto> = {}) {
    Object.assign(this, partial);
  }

  id!: string;
  spaceId!: string;
  ownerId!: string;
  title!: string;
  note: string | null = null;
  remindAt!: Date;
  createdAt!: Date;
  updatedAt!: Date;
  files: ReminderFileResponseDto[] = [];
}
