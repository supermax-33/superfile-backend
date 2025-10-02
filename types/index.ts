import { Request } from 'express';
import { Readable } from 'node:stream';
import { SpaceMember } from '@prisma/client';

export type OAuthProfile = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  emailVerified?: boolean;
};

export type SessionMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export type RequestWithUser = Request & {
  user?: {
    userId: string;
  };
  spaceMembership?: SpaceMember;
};

export type CreateSessionParams = {
  id: string;
  userId: string;
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
};

export type RotateSessionParams = {
  sessionId: string;
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
};

export type ValidateSessionParams = {
  sessionId: string;
  userId: string;
  refreshToken: string;
};

export type AssertSessionActiveParams = {
  sessionId: string;
  userId: string;
};

export type FileUploadProgressState = {
  fileId: string;
  bytesTransferred: number;
  bytesTotal: number;
  startedAt: Date;
  updatedAt: Date;
};

export type FileUploadProgressSnapshot = {
  fileId: string;
  bytesTransferred: number;
  bytesTotal: number;
  percent: number;
  startedAt: Date;
  updatedAt: Date;
};

export type UploadParams = {
  key: string;
  body: Readable | Buffer;
  contentType: string;
  contentLength: number;
  onProgress?: (loadedBytes: number, totalBytes?: number) => void;
};

export type DownloadResult = {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
};
