import { ApiProperty } from '@nestjs/swagger';
import { ConversationMessageRole } from '@prisma/client';

export class ConversationMessageFileReferenceDto {
  @ApiProperty({ example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab' })
  fileId!: string;

  @ApiProperty({ example: 'file-abc123' })
  openAiFileId!: string;

  @ApiProperty({
    description: 'A short-lived URL that allows the client to download the referenced file.',
    example: 'https://files.superfile.ai/download?token=example',
  })
  downloadUrl!: string;

  constructor(partial: Partial<ConversationMessageFileReferenceDto>) {
    Object.assign(this, partial);
  }
}

export class ConversationMessageReferencesDto {
  @ApiProperty({ type: [ConversationMessageFileReferenceDto] })
  files!: ConversationMessageFileReferenceDto[];

  constructor(files: ConversationMessageFileReferenceDto[]) {
    this.files = files;
  }
}

export class ConversationMessageResponseDto {
  @ApiProperty({ example: '2c7a4d79-6c88-4f21-9c46-ef130f8a9b58' })
  id!: string;

  @ApiProperty({ enum: ConversationMessageRole })
  role!: ConversationMessageRole;

  @ApiProperty({ example: 'Here is a quick summary of your documents…' })
  content!: string;

  @ApiProperty({ example: '2024-03-01T12:05:00.000Z' })
  createdAt!: Date;

  @ApiProperty({
    required: false,
    nullable: true,
    type: ConversationMessageReferencesDto,
  })
  references?: ConversationMessageReferencesDto | null;

  constructor(partial: Partial<ConversationMessageResponseDto>) {
    Object.assign(this, partial);
  }
}
