import { ConversationRole } from '@prisma/client';

export class ConversationMessageFileReferenceDto {
  fileId!: string;
  openAiFileId!: string;
  downloadUrl!: string;

  constructor(partial: Partial<ConversationMessageFileReferenceDto>) {
    Object.assign(this, partial);
  }
}

export class ConversationMessageReferencesDto {
  files!: ConversationMessageFileReferenceDto[];

  constructor(files: ConversationMessageFileReferenceDto[]) {
    this.files = files;
  }
}

export class ConversationMessageResponseDto {
  id!: string;
  role!: ConversationRole;
  content!: string;
  createdAt!: Date;
  references?: ConversationMessageReferencesDto | null;
  actions?: Record<string, unknown> | null;

  constructor(partial: Partial<ConversationMessageResponseDto>) {
    Object.assign(this, partial);
  }
}
