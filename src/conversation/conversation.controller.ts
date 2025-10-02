import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  Version,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from '../auth/filters/jwt-exception.filter';
import { RequestWithUser } from 'types';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { ConversationMessageResponseDto } from './dto/conversation-message-response.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { RequireSpaceRole } from '../space-member/decorators/require-space-role.decorator';
import { SpaceRoleGuard } from '../space-member/guards/space-role.guard';
import { SpaceRole } from '@prisma/client';
@Controller()
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
  @Post('spaces/:spaceId/conversations')
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.EDITOR, { spaceIdParam: 'spaceId' })
  async createConversation(
    @Req() request: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    const userId = this.extractUserId(request);
    return this.conversations.createConversation(userId, spaceId, dto.title);
  }

  @Version('1')
  @Get('spaces/:spaceId/conversations')
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.VIEWER, { spaceIdParam: 'spaceId' })
  async listConversations(
    @Req() request: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
  ): Promise<ConversationResponseDto[]> {
    const userId = this.extractUserId(request);
    return this.conversations.listConversations(userId, spaceId);
  }

  @Version('1')
  @Get('conversations/:id/messages')
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.VIEWER, { conversationIdParam: 'id' })
  async getConversationMessages(
    @Param('id', new ParseUUIDPipe()) conversationId: string,
    @Req() request: RequestWithUser,
  ): Promise<ConversationMessageResponseDto[]> {
    const userId = this.extractUserId(request);
    return this.conversations.getConversationMessages(conversationId, userId);
  }

  @Version('1')
  @Post('conversations/:id/messages')
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.EDITOR, { conversationIdParam: 'id' })
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  streamAssistantReply(
    @Param('id', new ParseUUIDPipe()) conversationId: string,
    @Req() request: RequestWithUser,
    @Body() dto: SendMessageDto,
  ): Observable<{ data: unknown; event?: string }> {
    const userId = this.extractUserId(request);
    return this.conversations.streamAssistantReply(conversationId, userId, dto);
  }

  @Version('1')
  @Delete('conversations/:id')
  @UseGuards(SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.MANAGER, { conversationIdParam: 'id' })
  async deleteConversation(
    @Param('id', new ParseUUIDPipe()) conversationId: string,
    @Req() request: RequestWithUser,
  ): Promise<void> {
    const userId = this.extractUserId(request);
    await this.conversations.deleteConversation(conversationId, userId);
  }
}
