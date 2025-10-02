import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
  Version,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from '../auth/filters/jwt-exception.filter';
import { RequestWithUser } from 'types';
import { SpaceMemberService } from './space-member.service';
import { AddSpaceMemberDto } from './dto/add-space-member.dto';
import { UpdateSpaceMemberRoleDto } from './dto/update-space-member-role.dto';
import { SpaceMemberResponseDto } from './dto/space-member-response.dto';
import { SpaceRole } from '@prisma/client';
import { RequireSpaceRole } from './decorators/space-role.decorator';
import { SpaceRoleGuard } from './guards/space-role.guard';

@Controller('spaces/:spaceId/members')
@UseFilters(JwtExceptionFilter)
@UseGuards(JwtAuthGuard, SpaceRoleGuard)
export class SpaceMemberController {
  constructor(private readonly members: SpaceMemberService) {}

  @Version('1')
  @Get()
  @RequireSpaceRole(SpaceRole.VIEWER, { source: 'param', key: 'spaceId' })
  async list(
    @Req() request: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
  ): Promise<SpaceMemberResponseDto[]> {
    const userId = this.getUserId(request);
    return this.members.listMembers(userId, spaceId);
  }

  @Version('1')
  @Post()
  @RequireSpaceRole(SpaceRole.OWNER, { source: 'param', key: 'spaceId' })
  async add(
    @Req() request: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Body() dto: AddSpaceMemberDto,
  ): Promise<SpaceMemberResponseDto> {
    const userId = this.getUserId(request);
    return this.members.addMember(userId, spaceId, dto);
  }

  @Version('1')
  @Patch(':memberId')
  @RequireSpaceRole(SpaceRole.OWNER, { source: 'param', key: 'spaceId' })
  async updateRole(
    @Req() request: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() dto: UpdateSpaceMemberRoleDto,
  ): Promise<SpaceMemberResponseDto> {
    const userId = this.getUserId(request);
    return this.members.updateMemberRole(userId, spaceId, memberId, dto);
  }

  @Version('1')
  @Delete(':memberId')
  @RequireSpaceRole(SpaceRole.OWNER, { source: 'param', key: 'spaceId' })
  async remove(
    @Req() request: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ): Promise<void> {
    const userId = this.getUserId(request);
    await this.members.removeMember(userId, spaceId, memberId);
  }

  private getUserId(request: RequestWithUser): string {
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user context is required.',
      );
    }

    return userId;
  }
}
