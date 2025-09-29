import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const MAX_MESSAGE_LENGTH = 4000;

export class SendMessageDto {
  @ApiProperty({
    description: 'The user question or instruction to send to the assistant.',
    example: 'Summarize the highlights from the uploaded earnings reports.',
    maxLength: MAX_MESSAGE_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  content!: string;
}
