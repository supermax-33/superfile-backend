import { parseDuration } from 'utils/helpers';

export const AUTH_EMAIL_OTP_LENGTH = 6;
export const AUTH_EMAIL_OTP_TTL = '10m';
export const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
export const JWT_ACCESS_TOKEN_TTL = '15m';
export const JWT_REFRESH_TOKEN_TTL = '30d';
export const ACCESS_TOKEN_EXPIRY_MS = parseDuration(JWT_ACCESS_TOKEN_TTL);
export const REFRESH_TOKEN_EXPIRY_MS = parseDuration(JWT_REFRESH_TOKEN_TTL);
