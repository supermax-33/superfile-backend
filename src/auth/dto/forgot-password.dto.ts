import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address that should receive the password reset OTP.',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
