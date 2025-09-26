import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Registered email used during signup.',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Account password. Must match the stored password for the email.',
    example: 'StrongP@ssw0rd',
  })
  @MinLength(6)
  password: string;
}
