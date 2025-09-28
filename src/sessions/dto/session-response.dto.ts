export class SessionResponseDto {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
}
