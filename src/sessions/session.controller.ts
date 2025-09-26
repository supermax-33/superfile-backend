import {
  Controller,
  Delete,
  Get,
  Param,
  Request,
  UseFilters,
  UseGuards,
  Version,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';
import { SessionService } from './session.service';
import { SessionResponseDto } from './dto/session-response.dto';

@ApiTags('sessions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@UseFilters(JwtExceptionFilter)
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Version('1')
  @Get()
  @ApiOperation({
    summary: 'List all active sessions for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active sessions retrieved successfully.',
    type: SessionResponseDto,
    isArray: true,
  })
  async listActiveSessions(@Request() req): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionService.listActiveSessions(
      req.user.userId,
    );
    return sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
    }));
  }

  @Version('1')
  @Delete(':sessionId')
  @ApiOperation({
    summary: 'Invalidate a specific session for the authenticated user.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Identifier of the session to invalidate.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session invalidated successfully.',
  })
  async invalidateSession(
    @Request() req,
    @Param('sessionId') sessionId: string,
  ) {
    await this.sessionService.revokeSessionForUser(req.user.userId, sessionId);
    return { message: 'Session invalidated.' };
  }

  @Version('1')
  @Delete()
  @ApiOperation({
    summary: 'Invalidate all sessions for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'All user sessions invalidated successfully.',
  })
  async invalidateAllSessions(@Request() req) {
    await this.sessionService.revokeAllSessionsForUser(req.user.userId);
    return { message: 'All sessions invalidated.' };
  }
}
