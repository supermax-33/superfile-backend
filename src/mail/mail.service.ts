import { Injectable } from '@nestjs/common';
import { ResendService } from './resend.service';

@Injectable()
export class MailService {
  constructor(private readonly resendService: ResendService) {}

  async sendVerificationEmail(email: string, token: string) {
    const subject = 'Verify your email';
    const html = `<p>Click <a href="http://localhost:3000/api/v1/auth/verify-email?token=${token}">here</a> to verify your email.</p>`;
    await this.resendService.sendEmail(email, subject, html);
    return true;
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const subject = 'Password Reset Request';
    const html = `<p>You requested a password reset. Click <a href="http://localhost:3000/api/v1/auth/reset-password?token=${token}">here</a> to reset your password.</p>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request a password reset, please ignore this email.</p>`;
    await this.resendService.sendEmail(email, subject, html);
    return true;
  }
}
