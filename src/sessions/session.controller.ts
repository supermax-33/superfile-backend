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
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';
import { SessionService } from './session.service';
import { SessionResponseDto } from './dto/session-response.dto';
@UseGuards(JwtAuthGuard)
@UseFilters(JwtExceptionFilter)
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Version('1')
  @Get()
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
  async invalidateSession(
    @Request() req,
    @Param('sessionId') sessionId: string,
  ) {
    await this.sessionService.revokeSessionForUser(req.user.userId, sessionId);
    return { message: 'Session invalidated.' };
  }

  @Version('1')
  @Delete()
  async invalidateAllSessions(@Request() req) {
    await this.sessionService.revokeAllSessionsForUser(req.user.userId);
    return { message: 'All sessions invalidated.' };
  }
}
