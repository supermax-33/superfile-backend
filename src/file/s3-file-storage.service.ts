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
import { createHash, createHmac } from 'node:crypto';

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

  async getPresignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    if (expiresInSeconds <= 0) {
      throw new Error('expiresInSeconds must be greater than 0');
    }

    const region = await this.resolveRegion();
    const credentials = await this.resolveCredentials();
    const endpoint = await this.client.config.endpoint?.();

    if (!endpoint) {
      throw new Error('S3 endpoint could not be resolved');
    }

    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = this.formatDateStamp(now);
    const service = 's3';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const forcePathStyle = Boolean((this.client.config as any).forcePathStyle);
    const host = this.buildHost(endpoint.hostname, this.bucket, forcePathStyle);
    const portSegment = endpoint.port ? `:${endpoint.port}` : '';

    const canonicalKey = this.encodeKey(key);
    const basePath = endpoint.path ?? '';
    const canonicalUri = this.buildCanonicalUri(
      basePath,
      canonicalKey,
      forcePathStyle,
    );

    const signedHeaders = 'host';
    const canonicalHeaders = `host:${host}${portSegment}\n`;
    const queryEntries: Array<[string, string]> = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${credentials.accessKeyId}/${credentialScope}`],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(expiresInSeconds)],
      ['X-Amz-SignedHeaders', signedHeaders],
    ];

    if (credentials.sessionToken) {
      queryEntries.push(['X-Amz-Security-Token', credentials.sessionToken]);
    }

    const canonicalQuery = this.buildCanonicalQuery(queryEntries);

    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      '',
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const hashedCanonicalRequest = this.sha256(canonicalRequest);
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hashedCanonicalRequest,
    ].join('\n');

    const signingKey = this.getSigningKey(
      credentials.secretAccessKey,
      dateStamp,
      region,
      service,
    );

    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    const finalQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`;
    const protocol = (endpoint.protocol ?? 'https:').replace(/:$/, '');

    return `${protocol}://${host}${portSegment}${canonicalUri}?${finalQuery}`;
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

  private async resolveRegion(): Promise<string> {
    const regionProvider = this.client.config.region;
    if (!regionProvider) {
      throw new Error('S3 client region is not configured');
    }

    return typeof regionProvider === 'function'
      ? await regionProvider()
      : regionProvider;
  }

  private async resolveCredentials(): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  }> {
    const credentialsProvider = this.client.config.credentials;
    if (!credentialsProvider) {
      throw new Error('S3 client credentials are not configured');
    }

    const credentials = await credentialsProvider();
    const { accessKeyId, secretAccessKey, sessionToken } = credentials ?? {};

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 credentials are missing access key or secret');
    }

    return { accessKeyId, secretAccessKey, sessionToken };
  }

  private buildHost(
    endpointHost: string,
    bucket: string,
    forcePathStyle: boolean,
  ): string {
    if (forcePathStyle) {
      return endpointHost;
    }

    if (!bucket) {
      return endpointHost;
    }

    return `${bucket}.${endpointHost}`;
  }

  private buildCanonicalUri(
    basePath: string,
    encodedKey: string,
    forcePathStyle: boolean,
  ): string {
    const trimmedBase = basePath.endsWith('/')
      ? basePath.slice(0, -1)
      : basePath;
    const keyPath = forcePathStyle
      ? `/${this.bucket}/${encodedKey}`
      : `/${encodedKey}`;
    const fullPath = `${trimmedBase}${keyPath}`;
    return fullPath.startsWith('/') ? fullPath : `/${fullPath}`;
  }

  private buildCanonicalQuery(entries: Array<[string, string]>): string {
    return entries
      .map(
        ([key, value]) =>
          `${this.encodeRfc3986(key)}=${this.encodeRfc3986(value)}`,
      )
      .sort()
      .join('&');
  }

  private encodeKey(key: string): string {
    return key
      .split('/')
      .map((segment) => this.encodeRfc3986(segment))
      .join('/');
  }

  private encodeRfc3986(value: string): string {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private getSigningKey(
    secretAccessKey: string,
    dateStamp: string,
    region: string,
    service: string,
  ): Buffer {
    const kDate = createHmac('sha256', `AWS4${secretAccessKey}`)
      .update(dateStamp)
      .digest();
    const kRegion = createHmac('sha256', kDate).update(region).digest();
    const kService = createHmac('sha256', kRegion).update(service).digest();
    return createHmac('sha256', kService).update('aws4_request').digest();
  }

  private formatAmzDate(date: Date): string {
    return `${date.getUTCFullYear()}${this.pad(date.getUTCMonth() + 1)}${this.pad(
      date.getUTCDate(),
    )}T${this.pad(date.getUTCHours())}${this.pad(date.getUTCMinutes())}${this.pad(
      date.getUTCSeconds(),
    )}Z`;
  }

  private formatDateStamp(date: Date): string {
    return `${date.getUTCFullYear()}${this.pad(date.getUTCMonth() + 1)}${this.pad(
      date.getUTCDate(),
    )}`;
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
