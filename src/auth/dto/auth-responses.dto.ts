import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({
    description: 'Human-readable status message.',
    example: 'Signup successful, verification code sent.',
  })
  message: string;
}

export class AuthTokensResponseDto {
  @ApiProperty({
    description: 'JWT access token used to authorize API requests.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI...access',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token used to obtain new access tokens.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI...refresh',
  })
  refreshToken: string;
}

export class VerifyResetCodeResponseDto {
  @ApiProperty({ description: 'Indicates whether the provided code is valid.' })
  valid: boolean;

  @ApiProperty({
    description: 'Status message describing the result of the verification.',
    example: 'User authenticated. Please reset your password.',
  })
  message: string;

  @ApiProperty({
    required: false,
    description:
      'Short-lived access token returned when the reset code is valid. Use it to authorize the password reset request.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI...tempAccess',
  })
  accessToken?: string;
}
