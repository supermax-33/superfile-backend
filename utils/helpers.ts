import * as ms from 'ms';
import { randomUUID } from 'node:crypto';

export function generateOtp(length: number): string {
  const max = 10 ** length;
  const code = Math.floor(Math.random() * max)
    .toString()
    .padStart(length, '0');
  return code;
}

// Parses a duration string (e.g., "10m", "2h") or number of milliseconds.
export function parseDuration(value: string | number): number {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  const parsed = typeof value === 'string' ? ms(value) : undefined;
  if (typeof parsed === 'number') {
    return parsed;
  }
}

export function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function formatError(prefix: string, error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';

  return `${prefix}: ${message}`;
}

export function sanitizeFilename(filename: string): string {
  return (
    filename
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9\-_.]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 255) || 'file'
  );
}

export function buildS3Key(spaceId: string, originalName: string): string {
  const safeName = sanitizeFilename(originalName);
  const unique = randomUUID();
  return `spaces/${spaceId}/files/${unique}-${safeName}`;
}
