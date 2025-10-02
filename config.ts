import { parseDuration } from 'utils/helpers';

// Authentication and security settings
export const AUTH_EMAIL_OTP_LENGTH = 6;
export const AUTH_EMAIL_OTP_TTL = '10m';
export const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
export const JWT_ACCESS_TOKEN_TTL = '15m';
export const JWT_REFRESH_TOKEN_TTL = '30d';
export const ACCESS_TOKEN_EXPIRY_MS = parseDuration(JWT_ACCESS_TOKEN_TTL);
export const REFRESH_TOKEN_EXPIRY_MS = parseDuration(JWT_REFRESH_TOKEN_TTL);

// File upload and processing constraints
export const ALLOWED_MIME_TYPES = Object.freeze(['application/pdf']);
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const FILE_UPLOAD_FIELD = 'files';
export const VECTOR_STORE_NAME_PREFIX = 'superfile-space';

// Space invitations
export const SPACE_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
