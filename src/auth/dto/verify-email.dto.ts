import { ApiProperty } from '@nestjs/swagger';
import { Length, IsNumberString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Six-digit verification code sent to the registered email.',
    example: '123456',
  })
  @IsNumberString()
  @Length(6, 6)
  code: string;
}
