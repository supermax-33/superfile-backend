import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description:
      'Short-lived access token obtained after verifying the password reset code.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI...reset',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password for the account.',
    example: 'AnotherStr0ngP@ss',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
