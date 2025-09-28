import * as ms from 'ms';

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
