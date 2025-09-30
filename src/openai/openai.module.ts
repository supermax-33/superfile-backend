import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OpenAiVectorStoreService } from './openai-vector-store.service';
import { OPENAI_CLIENT_TOKEN } from './openai.tokens';

@Module({
  imports: [ConfigModule],
  providers: [
    OpenAiVectorStoreService,
    {
      provide: OPENAI_CLIENT_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY must be configured');
        }

        return new OpenAI({ apiKey });
      },
    },
  ],
  exports: [OpenAiVectorStoreService],
})
export class OpenAiModule {}
