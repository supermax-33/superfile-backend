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
}
