import { ApiProperty } from '@nestjs/swagger';

export class ConversationResponseDto {
  @ApiProperty({ example: '0f4f1141-1f2c-4555-8a47-65d5bb1ec2f4' })
  id!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'Onboarding documents',
  })
  title?: string | null;

  @ApiProperty({ example: '2024-03-01T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-03-01T12:05:00.000Z' })
  updatedAt!: Date;

  constructor(partial: Partial<ConversationResponseDto>) {
    Object.assign(this, partial);
  }
}
