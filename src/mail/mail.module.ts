import { Module } from '@nestjs/common';
import { ResendService } from './resend.service';
import { MailService } from './mail.service';

@Module({
  providers: [MailService, ResendService],
  exports: [MailService],
})
export class MailModule {}
