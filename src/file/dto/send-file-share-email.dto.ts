import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsUUID } from 'class-validator';

export class SendFileShareEmailDto {
  @ApiProperty({ description: 'Identifier of the share to email.' })
  @IsUUID()
  shareId!: string;

  @ApiProperty({
    description:
      'Email address of the recipient who should receive the share link.',
  })
  @IsEmail()
  recipientEmail!: string;
}
