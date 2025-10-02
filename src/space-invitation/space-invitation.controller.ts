import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  Version,
} from '@nestjs/common';
import { SpaceRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from '../auth/filters/jwt-exception.filter';
import { RequireSpaceRole } from '../space-member/decorators/space-role.decorator';
import { SpaceRoleGuard } from '../space-member/guards/space-role.guard';
import { RequestWithUser } from 'types';
import { CreateSpaceInvitationDto } from './dto/create-space-invitation.dto';
import { SpaceInvitationResponseDto } from './dto/space-invitation-response.dto';
import { UpdateSpaceInvitationRoleDto } from './dto/update-space-invitation-role.dto';
import { SpaceInvitationService } from './space-invitation.service';

@Controller('spaces')
export class SpaceInvitationController {
  constructor(private readonly spaceInvitations: SpaceInvitationService) {}

  @Version('1')
  @Post(':id/invitations')
  @UseFilters(JwtExceptionFilter)
  @UseGuards(JwtAuthGuard, SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.MANAGER, { source: 'param', key: 'id' })
  async createInvitation(
    @Param('id') spaceId: string,
    @Body() dto: CreateSpaceInvitationDto,
    @Req() request: RequestWithUser,
  ): Promise<SpaceInvitationResponseDto> {
    const actorId = request.user?.userId;

    if (!actorId) {
      throw new UnauthorizedException(
        'Authenticated user context is required to send invitations.',
      );
    }

    return this.spaceInvitations.createInvitation(actorId, spaceId, dto);
  }

  @Version('1')
  @Patch(':id/invitations/:invitationId/role')
  @UseFilters(JwtExceptionFilter)
  @UseGuards(JwtAuthGuard, SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.MANAGER, { source: 'param', key: 'id' })
  async updateInvitationRole(
    @Param('id') spaceId: string,
    @Param('invitationId') invitationId: string,
    @Body() dto: UpdateSpaceInvitationRoleDto,
    @Req() request: RequestWithUser,
  ): Promise<SpaceInvitationResponseDto> {
    const actorId = request.user?.userId;

    if (!actorId) {
      throw new UnauthorizedException(
        'Authenticated user context is required to change invitation roles.',
      );
    }

    return this.spaceInvitations.updateInvitationRole(
      actorId,
      spaceId,
      invitationId,
      dto,
    );
  }

  @Version('1')
  @Get(':id/invitations')
  @UseFilters(JwtExceptionFilter)
  @UseGuards(JwtAuthGuard, SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.MANAGER, { source: 'param', key: 'id' })
  async listInvitations(
    @Param('id') spaceId: string,
  ): Promise<SpaceInvitationResponseDto[]> {
    return this.spaceInvitations.listInvitations(spaceId);
  }

  @Version('1')
  @Post('invitations/:invitationId/accept')
  @UseFilters(JwtExceptionFilter)
  @UseGuards(JwtAuthGuard)
  async acceptInvitation(
    @Param('invitationId') invitationId: string,
    @Query('token') token: string,
    @Req() request: RequestWithUser,
  ): Promise<SpaceInvitationResponseDto> {
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException(
        'You must be authenticated to accept an invitation.',
      );
    }

    return this.spaceInvitations.acceptInvitation(invitationId, token, userId);
  }

  @Version('1')
  @Post('invitations/:invitationId/reject')
  async rejectInvitation(
    @Param('invitationId') invitationId: string,
    @Query('token') token: string,
  ): Promise<SpaceInvitationResponseDto> {
    return this.spaceInvitations.rejectInvitation(invitationId, token);
  }
}
