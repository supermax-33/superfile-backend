import { IsEmail, IsUUID } from 'class-validator';

export class SendFileShareEmailDto {
  @IsUUID()
  shareId!: string;

  @IsEmail()
  recipientEmail!: string;
}
