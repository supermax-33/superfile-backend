import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import {
  Conversation,
  ConversationMessage,
  ConversationRole,
  FileStatus,
  Prisma,
} from '@prisma/client';
import { Observable } from 'rxjs';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import {
  ConversationMessageReferencesDto,
  ConversationMessageResponseDto,
} from './dto/conversation-message-response.dto';
import { FilePresignedUrlService } from '../file/presigned-url.service';
import { OPENAI_CLIENT_TOKEN } from '../openai/openai.tokens';

const FALLBACK_NO_FILES_MESSAGE =
  'No files are present to answer your question. Please upload files first.';
const MODEL_NAME = 'gpt-4.1-mini';
const SSE_TOKEN_EVENT = 'token';
const SSE_FINAL_EVENT = 'final';

type StoredFileReference = {
  fileId: string;
  openAiFileId: string;
};

type StoredMessageReferences = {
  files?: StoredFileReference[];
};

type SseMessage = {
  data: unknown;
  event?: string;
};

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUrls: FilePresignedUrlService,
    @Inject(OPENAI_CLIENT_TOKEN) private readonly openai: OpenAI,
  ) {}

  async createConversation(
    userId: string,
    spaceId: string,
    title?: string,
  ): Promise<ConversationResponseDto> {
    await this.ensureSpaceAccess(spaceId, userId);

    const conversation = await this.prisma.conversation.create({
      data: {
        spaceId,
        title: title ?? null,
        manuallyRenamed: Boolean(title),
      },
    });

    return new ConversationResponseDto(conversation);
  }

  async listConversations(
    userId: string,
    spaceId: string,
  ): Promise<ConversationResponseDto[]> {
    await this.ensureSpaceAccess(spaceId, userId);

    const conversations = await this.prisma.conversation.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
    });

    return conversations.map(
      (conversation) => new ConversationResponseDto(conversation),
    );
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMessageResponseDto[]> {
    const conversation = await this.ensureConversationAccess(
      conversationId,
      userId,
    );

    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      messages.map((message) =>
        this.hydrateMessage(message, conversation.spaceId),
      ),
    );
  }

  streamAssistantReply(
    conversationId: string,
    userId: string,
    dto: SendMessageDto,
  ): Observable<SseMessage> {
    return new Observable<SseMessage>((observer) => {
      let streamClosed = false;
      let responseStream: any;
      const closeStream = () => {
        if (!streamClosed) {
          streamClosed = true;
          observer.complete();
        }
      };

      const handleError = async (error: unknown) => {
        this.logger.error('Streaming assistant reply failed', error as Error);
        if (!streamClosed) {
          streamClosed = true;
          observer.error(error);
        }
      };

      (async () => {
        const conversation = await this.ensureConversationAccess(
          conversationId,
          userId,
        );

        const { spaceId } = conversation;

        await this.prisma.conversationMessage.create({
          data: {
            conversationId,
            role: ConversationRole.USER,
            content: dto.content,
            references: null,
            actions: null,
          },
        });

        const space = await this.prisma.space.findUnique({
          where: { id: spaceId },
          select: { vectorStoreId: true },
        });

        if (!space) {
          throw new NotFoundException('Space not found.');
        }

        const { vectorStoreId } = space;

        const shouldDecline = await this.shouldDeclineAssistantResponse(
          spaceId,
          vectorStoreId,
        );
        if (shouldDecline) {
          const assistantMessage = await this.prisma.conversationMessage.create(
            {
              data: {
                conversationId,
                role: ConversationRole.ASSISTANT,
                content: FALLBACK_NO_FILES_MESSAGE,
                references: { files: [] },
                actions: null,
              },
            },
          );

          const hydrated = await this.hydrateMessage(assistantMessage, spaceId);
          observer.next({
            event: SSE_FINAL_EVENT,
            data: {
              message: hydrated,
              references: hydrated.references,
            },
          });
          closeStream();
          return;
        }

        if (!vectorStoreId) {
          throw new InternalServerErrorException(
            'Vector store identifier is missing for the space.',
          );
        }

        const history = await this.prisma.conversationMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' },
        });

        responseStream = await this.openai.responses.stream({
          model: MODEL_NAME,
          input: history.map((message) => ({
            role:
              message.role === ConversationRole.ASSISTANT
                ? 'assistant'
                : 'user',
            content: message.content,
          })),
          tools: [
            {
              type: 'file_search',
              vector_store_ids: [vectorStoreId],
            } as any,
          ],
          include: ['file_search_call.results'],
        } as any);

        let assistantText = '';
        responseStream.on('response.output_text.delta', (event: any) => {
          if (typeof event?.delta === 'string' && event.delta.length > 0) {
            assistantText += event.delta;
            observer.next({ event: SSE_TOKEN_EVENT, data: event.delta });
          }
        });

        responseStream.on('response.completed', async () => {
          try {
            const finalResponse = await responseStream.finalResponse();
            await this.persistAssistantMessage(
              conversationId,
              spaceId,
              assistantText,
              finalResponse,
              observer,
            );
            closeStream();
          } catch (error) {
            await handleError(error);
          }
        });

        responseStream.on('response.failed', async (event: any) => {
          await handleError(
            new InternalServerErrorException(
              event?.error?.message ?? 'Assistant response failed.',
            ),
          );
        });

        responseStream.on('error', handleError);
        responseStream.on('abort', handleError);
      })().catch(handleError);

      return () => {
        streamClosed = true;
        if (responseStream) {
          try {
            responseStream.abort?.();
          } catch (error) {
            this.logger.debug?.(
              `Failed to abort OpenAI response stream: ${error}`,
            );
          }
        }
      };
    });
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await this.ensureConversationAccess(conversationId, userId);
    await this.prisma.conversation.delete({ where: { id: conversationId } });
  }

  private async persistAssistantMessage(
    conversationId: string,
    spaceId: string,
    assistantText: string,
    finalResponse: any,
    observer: {
      next: (message: SseMessage) => void;
    },
  ): Promise<void> {
    const fileIds = this.extractReferencedFileIds(finalResponse);
    const storedReferences = await this.buildStoredReferences(spaceId, fileIds);

    const assistantMessage = await this.prisma.conversationMessage.create({
      data: {
        conversationId,
        role: ConversationRole.ASSISTANT,
        content: assistantText,
        references: storedReferences,
        actions: null,
      },
    });

    const hydrated = await this.hydrateMessage(assistantMessage, spaceId);
    observer.next({
      event: SSE_FINAL_EVENT,
      data: {
        message: hydrated,
        references: hydrated.references,
      },
    });
  }

  private async shouldDeclineAssistantResponse(
    spaceId: string,
    vectorStoreId: string | null,
  ): Promise<boolean> {
    if (!vectorStoreId) {
      return true;
    }

    const processedFile = await this.prisma.file.findFirst({
      where: {
        spaceId,
        status: FileStatus.SUCCESS,
      },
      select: { id: true },
    });

    return !processedFile;
  }

  private async ensureConversationAccess(
    conversationId: string,
    userId: string,
  ): Promise<Conversation & { space: { ownerId: string } }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { space: { select: { ownerId: true } } },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    if (conversation.space.ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this conversation.',
      );
    }

    return conversation;
  }

  private async ensureSpaceAccess(
    spaceId: string,
    userId: string,
  ): Promise<void> {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { ownerId: true },
    });

    if (!space) {
      throw new NotFoundException('Space not found.');
    }

    if (space.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this space.');
    }
  }

  private async hydrateMessage(
    message: ConversationMessage,
    spaceId: string,
  ): Promise<ConversationMessageResponseDto> {
    const references = await this.hydrateReferences(
      message.references,
      spaceId,
    );

    return new ConversationMessageResponseDto({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      references,
      actions: this.parseActions(message.actions),
    });
  }

  private parseActions(
    actions: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
      return null;
    }

    return actions as Record<string, unknown>;
  }

  private async hydrateReferences(
    references: Prisma.JsonValue | null,
    spaceId: string,
  ): Promise<ConversationMessageReferencesDto | null> {
    const storedReferences = this.parseStoredReferences(references);

    if (storedReferences.length === 0) {
      return new ConversationMessageReferencesDto([]);
    }

    const files = await this.prisma.file.findMany({
      where: {
        spaceId,
        id: { in: storedReferences.map((ref) => ref.fileId) },
      },
      select: { id: true, openAiFileId: true, s3Key: true },
    });

    const fileMap = new Map(files.map((file) => [file.id, file]));

    const hydratedFiles = await Promise.all(
      storedReferences.map(async (reference) => {
        const file = fileMap.get(reference.fileId);
        if (!file) {
          return null;
        }
        const downloadUrl = await this.fileUrls.getDownloadUrl(file.s3Key);
        return {
          fileId: reference.fileId,
          openAiFileId: reference.openAiFileId,
          downloadUrl,
        };
      }),
    );

    const filtered = hydratedFiles.filter(
      (
        reference,
      ): reference is {
        fileId: string;
        openAiFileId: string;
        downloadUrl: string;
      } => reference !== null,
    );

    return new ConversationMessageReferencesDto(filtered);
  }

  private parseStoredReferences(
    references: Prisma.JsonValue | null,
  ): StoredFileReference[] {
    if (!references || typeof references !== 'object') {
      return [];
    }

    const payload = references as StoredMessageReferences;
    if (!Array.isArray(payload.files)) {
      return [];
    }

    return payload.files.filter((reference): reference is StoredFileReference =>
      Boolean(
        reference &&
          typeof reference.fileId === 'string' &&
          typeof reference.openAiFileId === 'string',
      ),
    );
  }

  private async buildStoredReferences(
    spaceId: string,
    openAiFileIds: string[],
  ): Promise<StoredMessageReferences> {
    if (openAiFileIds.length === 0) {
      return { files: [] };
    }

    const files = await this.prisma.file.findMany({
      where: {
        spaceId,
        openAiFileId: { in: openAiFileIds },
      },
      select: { id: true, openAiFileId: true },
    });

    return {
      files: files
        .filter((file) => file.openAiFileId)
        .map((file) => ({
          fileId: file.id,
          openAiFileId: file.openAiFileId!,
        })),
    };
  }

  private extractReferencedFileIds(finalResponse: any): string[] {
    const identifiers = new Set<string>();
    const outputItems = Array.isArray(finalResponse?.output)
      ? finalResponse.output
      : [];

    for (const item of outputItems) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      this.collectFileIdsFromItem(item, identifiers);
    }

    return Array.from(identifiers);
  }

  private collectFileIdsFromItem(item: any, identifiers: Set<string>): void {
    if (Array.isArray(item?.results)) {
      this.collectFromResults(item.results, identifiers);
    }

    if (item?.file_search?.results) {
      this.collectFromResults(item.file_search.results, identifiers);
    }

    if (item?.tool?.file_search?.results) {
      this.collectFromResults(item.tool.file_search.results, identifiers);
    }

    if (item?.tool_call?.file_search?.results) {
      this.collectFromResults(item.tool_call.file_search.results, identifiers);
    }

    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const contentPart of item.content) {
        if (contentPart?.type === 'output_text') {
          const annotations = Array.isArray(contentPart.annotations)
            ? contentPart.annotations
            : [];
          for (const annotation of annotations) {
            this.tryAddIdentifier(annotation?.file_id, identifiers);
            this.tryAddIdentifier(annotation?.fileId, identifiers);
          }
        }
        if (contentPart?.type === 'output_file') {
          this.tryAddIdentifier(contentPart?.file_id, identifiers);
        }
      }
    }
  }

  private collectFromResults(results: any, identifiers: Set<string>): void {
    if (!Array.isArray(results)) {
      return;
    }

    for (const result of results) {
      this.tryAddIdentifier(result?.file_id, identifiers);
      this.tryAddIdentifier(result?.fileId, identifiers);
    }
  }

  private tryAddIdentifier(value: unknown, identifiers: Set<string>): void {
    if (typeof value === 'string' && value.length > 0) {
      identifiers.add(value);
    }
  }
}
