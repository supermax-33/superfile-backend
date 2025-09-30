export class ConversationResponseDto {
  id!: string;
  spaceId!: string;
  title?: string | null;
  manuallyRenamed!: boolean;
  autoTitleGeneratedAt?: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<ConversationResponseDto>) {
    Object.assign(this, partial);
  }
}
