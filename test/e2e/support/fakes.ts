import { CanActivate, ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

type UploadedFileRecord = {
  buffer: Buffer;
  contentType: string;
};

type VectorStoreRecord = {
  name: string;
  files: Map<string, UploadedFileRecord>;
};

export class FakeMailService {
  public readonly verificationEmails: Array<{ email: string; code: string }> = [];
  public readonly passwordResetEmails: Array<{ email: string; code: string }> = [];

  async sendVerificationEmail(email: string, code: string) {
    this.verificationEmails.push({ email, code });
  }

  async sendPasswordResetEmail(email: string, code: string) {
    this.passwordResetEmails.push({ email, code });
  }
}

export class FakeS3FileStorageService {
  private readonly objects = new Map<string, UploadedFileRecord>();

  async upload(params: {
    key: string;
    body: Readable | Buffer;
    contentType?: string;
    contentLength?: number;
    onProgress?: (loaded: number, total?: number) => void;
  }): Promise<void> {
    const buffer = await this.collectBuffer(params.body);
    this.objects.set(params.key, {
      buffer,
      contentType: params.contentType ?? 'application/octet-stream',
    });
    params.onProgress?.(buffer.length, params.contentLength ?? buffer.length);
  }

  async download(key: string) {
    const object = this.objects.get(key);
    if (!object) {
      throw new Error(`S3 object not found for key ${key}`);
    }

    return {
      stream: Readable.from(object.buffer),
      contentType: object.contentType,
      contentLength: object.buffer.length,
    };
  }

  async delete(key: string) {
    this.objects.delete(key);
  }

  async getPresignedUrl(key: string) {
    if (!this.objects.has(key)) {
      throw new Error(`Cannot generate URL for missing key ${key}`);
    }
    return `https://files.example.com/${encodeURIComponent(key)}`;
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  private async collectBuffer(input: Readable | Buffer): Promise<Buffer> {
    if (Buffer.isBuffer(input)) {
      return input;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of input) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

export class FakeOpenAiVectorStoreService {
  private readonly stores = new Map<string, VectorStoreRecord>();
  private storeCounter = 0;
  private fileCounter = 0;

  async createVectorStore(name: string): Promise<string> {
    const id = `vs_${++this.storeCounter}`;
    this.stores.set(id, { name, files: new Map() });
    return id;
  }

  async deleteVectorStore(id: string): Promise<void> {
    this.stores.delete(id);
  }

  async uploadFile(
    vectorStoreId: string,
    file: { buffer: Buffer; filename: string; mimetype: string },
  ): Promise<{ fileId: string; vectorStoreFileId: string; status: 'completed' }> {
    const store = this.stores.get(vectorStoreId);
    if (!store) {
      throw new Error(`Unknown vector store ${vectorStoreId}`);
    }
    const fileId = `openai-file-${++this.fileCounter}`;
    store.files.set(fileId, { buffer: file.buffer, contentType: file.mimetype });
    return {
      fileId,
      vectorStoreFileId: `vsf-${fileId}`,
      status: 'completed',
    };
  }

  async getFileStatus(vectorStoreId: string, fileId: string) {
    const store = this.stores.get(vectorStoreId);
    if (!store || !store.files.has(fileId)) {
      return { status: 'failed', lastError: 'File not found in vector store.' };
    }
    return { status: 'completed', lastError: null };
  }

  async deleteFile(vectorStoreId: string, fileId: string) {
    const store = this.stores.get(vectorStoreId);
    store?.files.delete(fileId);
  }

  listFileIds(vectorStoreId: string): string[] {
    const store = this.stores.get(vectorStoreId);
    if (!store) {
      return [];
    }
    return Array.from(store.files.keys());
  }
}

class FakeResponseStream extends EventEmitter {
  constructor(private readonly fileIds: string[]) {
    super();
    setImmediate(() => {
      this.emit('response.output_text.delta', { delta: 'Mock assistant response.' });
      setTimeout(() => {
        this.emit('response.completed');
      }, 5);
    });
  }

  async finalResponse() {
    return {
      output: [
        {
          file_search: {
            results: this.fileIds.map((fileId) => ({ file_id: fileId })),
          },
        },
      ],
    };
  }

  abort() {
    this.emit('abort');
  }
}

export class FakeOpenAiClient {
  constructor(private readonly vectorStores: FakeOpenAiVectorStoreService) {}

  readonly responses = {
    stream: async (options: any) => {
      const vectorStoreId = options?.tools?.[0]?.vector_store_ids?.[0];
      const fileIds = vectorStoreId
        ? this.vectorStores.listFileIds(vectorStoreId)
        : [];
      return new FakeResponseStream(fileIds);
    },
  };
}

export class FakeFilePresignedUrlService {
  async getDownloadUrl(key: string): Promise<string> {
    return `https://files.example.com/${encodeURIComponent(key)}`;
  }
}

export class FakeGoogleOAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    if (request.path.endsWith('/google')) {
      response.redirect('https://accounts.google.com/o/oauth2/v2/auth');
      return false;
    }

    request.user = {
      id: 'google-user-id',
      displayName: 'Google Test',
      emails: [
        {
          value: 'google.user@example.com',
          verified: true,
        },
      ],
    };

    return true;
  }
}
