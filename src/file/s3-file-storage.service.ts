import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'node:stream';
import { S3_CLIENT_TOKEN } from './file.tokens';
import { ConfigService } from '@nestjs/config';
import { DownloadResult, UploadParams } from 'types';

@Injectable()
export class S3FileStorageService {
  private readonly bucket: string;
  private readonly logger = new Logger(S3FileStorageService.name);

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

  async upload(params: UploadParams): Promise<void> {
    const body =
      params.body instanceof Readable
        ? params.body
        : Readable.from(params.body);

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: params.key,
        Body: body,
        ContentType: params.contentType,
        ContentLength: params.contentLength,
      },
      leavePartsOnError: false,
    });

    if (params.onProgress) {
      upload.on('httpUploadProgress', (event) => {
        if (typeof event.loaded === 'number') {
          params.onProgress(event.loaded, event.total);
        }
      });
    }

    await upload.done();
  }

  async download(key: string): Promise<DownloadResult> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('S3 object body is empty');
    }

    const stream = response.Body.transformToWebStream
      ? Readable.fromWeb(response.Body as any)
      : (response.Body as Readable);

    return {
      stream,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      this.logger.verbose?.(`HeadObject failed for ${key}: ${error}`);
      return false;
    }
  }
}
