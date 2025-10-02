import {
  buildInvitationLink,
  generateInvitationToken,
  hashInvitationToken,
  normalizeInvitationEmail,
  trimTrailingSlashes,
} from './invitation-helpers';

describe('invitation helpers', () => {
  it('normalizes emails by trimming and lowercasing', () => {
    expect(normalizeInvitationEmail('  Example@Email.com  ')).toBe(
      'example@email.com',
    );
  });

  it('hashes tokens deterministically with sha256', () => {
    const token = 'token-value';
    expect(hashInvitationToken(token)).toBe(
      'e6c02a5742ea9d4de588eb9b9de7bed43dc17011552186bed3e98b2c5958ff4a',
    );
  });

  it('generates random tokens with configurable byte length', () => {
    const token = generateInvitationToken(8);
    expect(token).toHaveLength(16);
    expect(generateInvitationToken(8)).not.toEqual(token);
  });

  it('strips trailing slashes from base URLs', () => {
    expect(trimTrailingSlashes('https://example.com///')).toBe(
      'https://example.com',
    );
    expect(trimTrailingSlashes('/path/only/')).toBe('/path/only');
  });

  it('builds invitation links with sanitized base URL', () => {
    const token = 'abc 123';
    expect(
      buildInvitationLink('https://app.local/', 'inv-1', 'accept', token),
    ).toBe('https://app.local/spaces/invitations/inv-1/accept?token=abc%20123');
    expect(buildInvitationLink('', 'inv-2', 'reject', 'token')).toBe(
      '/spaces/invitations/inv-2/reject?token=token',
    );
  });
});
