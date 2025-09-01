import { Injectable } from '@nestjs/common';

@Injectable()
export class ResendService {
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly baseUrl = 'https://api.resend.com/emails';

  async sendEmail(to: string, subject: string, html: string) {
    if (!this.apiKey) throw new Error('RESEND_API_KEY not set');
    await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        from: 'no-reply@supermax.dev',
      }),
    });
  }
}
