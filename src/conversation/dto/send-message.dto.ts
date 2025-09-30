import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const MAX_MESSAGE_LENGTH = 4000;

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  content!: string;
}
