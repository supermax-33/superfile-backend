import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email address that will receive the verification OTP.',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password for the new account. Minimum of 8 characters.',
    example: 'StrongP@ssw0rd',
  })
  @IsString()
  @MinLength(8)
  password: string;
}
