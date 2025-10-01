import { Injectable } from '@nestjs/common';
import { ResendService } from './resend.service';

@Injectable()
export class MailService {
  constructor(private readonly resendService: ResendService) {}

  async sendVerificationEmail(email: string, code: string) {
    const subject = 'Verify your email';
    const html = `<p>Your verification code is: <b>${code}</b></p><p>Enter this code in the app to verify your email. This code will expire in 10 minutes.</p>`;
    await this.resendService.sendEmail(email, subject, html);
    return true;
  }

  async sendPasswordResetEmail(email: string, code: string) {
    const subject = 'Password Reset Request';
    const html = `<p>Your password reset code is: <b>${code}</b></p><p>Enter this code in the app to reset your password. This code will expire in 10 minutes.</p><p>If you did not request a password reset, please ignore this email.</p>`;
    await this.resendService.sendEmail(email, subject, html);
    return true;
  }

  async sendFileShareEmail(
    email: string,
    link: string,
    filename: string,
    note: string | null,
    expiresAt: Date | null,
  ): Promise<void> {
    const subject = `A file has been shared with you`;
    const safeFilename = this.escapeHtml(filename);
    const safeLink = this.escapeHtml(link);
    const parts: string[] = [
      `<p>The file <strong>${safeFilename}</strong> has been shared with you.</p>`,
      `<p>You can access it securely using the link below:</p>`,
      `<p><a href="${safeLink}">${safeLink}</a></p>`,
    ];

    if (expiresAt) {
      parts.push(
        `<p>This link will expire on <strong>${expiresAt.toUTCString()}</strong>.</p>`,
      );
    }

    if (note) {
      parts.push(
        `<p><strong>Note from the sender:</strong><br/>${this.formatNote(note)}</p>`,
      );
    }

    parts.push(
      '<p>If you were not expecting this file, you can safely ignore this email.</p>',
    );

    await this.resendService.sendEmail(email, subject, parts.join(''));
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatNote(note: string): string {
    return this.escapeHtml(note).replace(/\n/g, '<br/>');
  }
}
