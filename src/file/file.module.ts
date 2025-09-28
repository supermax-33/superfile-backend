import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import OpenAI from 'openai';
import { PrismaModule } from '../prisma/prisma.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileOwnerGuard } from './guards/file-owner.guard';
import { FileProgressService } from './file-progress.service';
import { S3FileStorageService } from './s3-file-storage.service';
import { OpenAiVectorStoreService } from './openai-vector-store.service';
import { OPENAI_CLIENT_TOKEN, S3_CLIENT_TOKEN } from './file.tokens';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [FileController],
  providers: [
    FileService,
    FileOwnerGuard,
    FileProgressService,
    S3FileStorageService,
    OpenAiVectorStoreService,
    {
      provide: S3_CLIENT_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const region = config.get<string>('AWS_REGION');

        if (!region)
          throw new Error('AWS_S3_REGION or AWS_REGION must be configured');

        return new S3Client({ region });
      },
    },
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
  exports: [FileService],
})
export class FileModule {}
