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
}
