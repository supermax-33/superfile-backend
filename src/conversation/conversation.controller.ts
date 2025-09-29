import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  Version,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from '../auth/filters/jwt-exception.filter';
import { RequestWithUser } from 'types';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { ConversationMessageResponseDto } from './dto/conversation-message-response.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
@UseFilters(JwtExceptionFilter)
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private readonly conversations: ConversationService) {}

  private extractUserId(request: RequestWithUser): string {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User context is required.');
    }
    return userId;
  }

  @Version('1')
  @Post()
  @ApiOperation({ summary: 'Create a new conversation.' })
  @ApiCreatedResponse({ type: ConversationResponseDto })
  async createConversation(
    @Req() request: RequestWithUser,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    const userId = this.extractUserId(request);
    return this.conversations.createConversation(userId, dto.title);
  }

  @Version('1')
  @Get()
  @ApiOperation({ summary: 'List conversations for the authenticated user.' })
  @ApiOkResponse({ type: [ConversationResponseDto] })
  async listConversations(
    @Req() request: RequestWithUser,
  ): Promise<ConversationResponseDto[]> {
    const userId = this.extractUserId(request);
    return this.conversations.listConversations(userId);
  }

  @Version('1')
  @Get(':id/messages')
  @ApiOperation({
    summary: 'Fetch messages in a conversation, including fresh presigned URLs.',
  })
  @ApiOkResponse({ type: [ConversationMessageResponseDto] })
  async getConversationMessages(
    @Param('id') conversationId: string,
    @Req() request: RequestWithUser,
  ): Promise<ConversationMessageResponseDto[]> {
    const userId = this.extractUserId(request);
    return this.conversations.getConversationMessages(conversationId, userId);
  }

  @Version('1')
  @Post(':id/messages')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @ApiOperation({
    summary:
      'Send a message to the assistant and stream the reply using server-sent events.',
  })
  @ApiBody({ type: SendMessageDto })
  @ApiOkResponse({
    description:
      'SSE stream containing token events followed by a final message with file references.',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'event: token\ndata: partial text\n\n' +
            'event: final\ndata: {"message":{"content":"..."},"references":{"files":[{"fileId":"...","downloadUrl":"https://..."}]}}\n\n',
        },
      },
    },
  })
  streamAssistantReply(
    @Param('id') conversationId: string,
    @Req() request: RequestWithUser,
    @Body() dto: SendMessageDto,
  ): Observable<{ data: unknown; event?: string }> {
    const userId = this.extractUserId(request);
    return this.conversations.streamAssistantReply(conversationId, userId, dto);
  }
}
