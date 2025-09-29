import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { APIError } from 'openai/error';
import { toFile } from 'openai/uploads';
import { OPENAI_CLIENT_TOKEN } from './openai.tokens';

type UploadResult = {
  fileId: string;
  vectorStoreFileId: string;
  status: 'completed' | 'in_progress' | 'failed';
  lastError?: string | null;
};

type FileStatusResult = {
  status: 'completed' | 'in_progress' | 'failed' | 'cancelled';
  lastError?: string | null;
};

@Injectable()
export class OpenAiVectorStoreService {
  private readonly logger = new Logger(OpenAiVectorStoreService.name);

  constructor(@Inject(OPENAI_CLIENT_TOKEN) private readonly client: OpenAI) {}

  async createVectorStore(name: string): Promise<string> {
    const result = await this.client.vectorStores.create({ name });
    return result.id;
  }

  async deleteVectorStore(vectorStoreId: string): Promise<void> {
    try {
      await this.client.vectorStores.del(vectorStoreId);
    } catch (error) {
      if (this.isNotFound(error)) {
        return;
      }
      this.logger.warn(
        `Failed to delete vector store ${vectorStoreId}: ${error}`,
      );
      throw error;
    }
  }

  async uploadFile(
    vectorStoreId: string,
    file: {
      buffer: Buffer;
      filename: string;
      mimetype: string;
    },
  ): Promise<UploadResult> {
    const openAiFile = await this.client.files.create({
      file: await toFile(file.buffer, file.filename, {
        type: file.mimetype,
      }),
      purpose: 'assistants',
    });

    const vectorStoreFile = await this.client.vectorStores.files.createAndPoll(
      vectorStoreId,
      {
        file_id: openAiFile.id,
      },
    );

    if (vectorStoreFile.status !== 'completed') {
      const errorMessage = vectorStoreFile.last_error?.message;
      throw new Error(
        errorMessage ?? 'File indexing did not complete successfully.',
      );
    }

    return {
      fileId: openAiFile.id,
      vectorStoreFileId: vectorStoreFile.id,
      status: vectorStoreFile.status ?? 'failed',
    };
  }

  async getFileStatus(
    vectorStoreId: string,
    fileId: string,
  ): Promise<FileStatusResult> {
    const file = await this.client.vectorStores.files.retrieve(
      vectorStoreId,
      fileId,
    );

    return {
      status: file.status ?? 'failed',
      lastError: file.last_error?.message ?? null,
    };
  }

  async deleteFile(vectorStoreId: string, fileId: string): Promise<void> {
    await this.deleteVectorStoreFile(vectorStoreId, fileId);
    await this.deleteOpenAiFile(fileId);
  }

  private async deleteVectorStoreFile(
    vectorStoreId: string,
    fileId: string,
  ): Promise<void> {
    try {
      await this.client.vectorStores.files.del(vectorStoreId, fileId);
    } catch (error) {
      if (this.isNotFound(error)) {
        return;
      }
      this.logger.warn(
        `Failed to delete vector store file ${fileId} from ${vectorStoreId}: ${error}`,
      );
      throw error;
    }
  }

  private async deleteOpenAiFile(fileId: string): Promise<void> {
    try {
      await this.client.files.del(fileId);
    } catch (error) {
      if (this.isNotFound(error)) {
        return;
      }
      this.logger.warn(`Failed to delete OpenAI file ${fileId}: ${error}`);
      throw error;
    }
  }

  private isNotFound(error: unknown): boolean {
    return error instanceof APIError && error.status === 404;
  }
}
