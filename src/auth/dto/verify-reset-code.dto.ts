import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, Length } from 'class-validator';

export class VerifyResetCodeDto {
  @ApiProperty({
    description: 'Six-digit password reset OTP code sent to the user email.',
    example: '654321',
  })
  @IsNumberString()
  @Length(6, 6)
  code: string;
}
