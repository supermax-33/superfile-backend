export class MessageResponseDto {
  message: string;
}

export class AuthTokensResponseDto {
  accessToken: string;
  refreshToken: string;
}

export class VerifyResetCodeResponseDto {
  message: string;
  accessToken?: string;
}
