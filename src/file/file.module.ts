import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { PrismaModule } from '../prisma/prisma.module';
import { OpenAiModule } from '../openai/openai.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileOwnerGuard } from './guards/file-owner.guard';
import { FileProgressService } from './file-progress.service';
import { S3FileStorageService } from './s3-file-storage.service';
import { S3_CLIENT_TOKEN } from './file.tokens';

@Module({
  imports: [PrismaModule, ConfigModule, OpenAiModule],
  controllers: [FileController],
  providers: [
    FileService,
    FileOwnerGuard,
    FileProgressService,
    S3FileStorageService,
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
  ],
  exports: [FileService],
})
export class FileModule {}
