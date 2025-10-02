import { createHash, randomBytes } from 'node:crypto';

export type InvitationAction = 'accept' | 'reject';

export const normalizeInvitationEmail = (email: string): string =>
  email.trim().toLowerCase();

export const hashInvitationToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const generateInvitationToken = (bytes = 32): string =>
  randomBytes(bytes).toString('hex');

export const trimTrailingSlashes = (input: string): string =>
  input.replace(/\/+$/, '');

export const buildInvitationLink = (
  baseUrl: string,
  invitationId: string,
  action: InvitationAction,
  token: string,
): string => {
  const sanitizedBase = trimTrailingSlashes(baseUrl || '');
  const normalizedAction = action === 'reject' ? 'reject' : 'accept';
  const safeToken = encodeURIComponent(token);

  if (!sanitizedBase) {
    return `/spaces/invitations/${invitationId}/${normalizedAction}?token=${safeToken}`;
  }

  return `${sanitizedBase}/spaces/invitations/${invitationId}/${normalizedAction}?token=${safeToken}`;
};
