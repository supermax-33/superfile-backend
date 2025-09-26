import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleTokenDto {
  @ApiProperty({
    description: 'Google ID token obtained from the native or web Google SDK.',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2MzRiZ...googleIdToken',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
