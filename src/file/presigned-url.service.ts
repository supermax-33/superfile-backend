import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CLIENT_TOKEN } from './file.tokens';

const DEFAULT_URL_TTL_SECONDS = 300;

@Injectable()
export class FilePresignedUrlService {
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT_TOKEN) private readonly client: S3Client,
    configService: ConfigService,
  ) {
    const bucket = configService.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      throw new Error('AWS_S3_BUCKET must be configured');
    }
    this.bucket = bucket;
  }

  async getDownloadUrl(
    key: string,
    expiresInSeconds = DEFAULT_URL_TTL_SECONDS,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }
}
