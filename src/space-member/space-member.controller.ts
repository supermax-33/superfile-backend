import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SpaceRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from '../auth/filters/jwt-exception.filter';
import { RequestWithUser } from 'types';
import { SpaceMemberService } from './space-member.service';
import { SpaceMemberResponseDto } from './dto/space-member-response.dto';
import { CreateSpaceMemberDto } from './dto/create-space-member.dto';
import { UpdateSpaceMemberDto } from './dto/update-space-member.dto';
import { RequireSpaceRole } from './decorators/require-space-role.decorator';
import { SpaceRoleGuard } from './guards/space-role.guard';

@ApiTags('space-members')
@Controller('spaces/:spaceId/members')
@UseFilters(JwtExceptionFilter)
@UseGuards(JwtAuthGuard, SpaceRoleGuard)
export class SpaceMemberController {
  constructor(private readonly members: SpaceMemberService) {}

  private getUserId(request: RequestWithUser): string {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User context is required.');
    }
    return userId;
  }

  @Version('1')
  @Get()
  @RequireSpaceRole(SpaceRole.OWNER, { spaceIdParam: 'spaceId' })
  @ApiOperation({
    summary: 'List space members',
    description: 'Requires OWNER role in the target space.',
  })
  async list(
    @Req() request: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
  ): Promise<SpaceMemberResponseDto[]> {
    const ownerId = this.getUserId(request);
    return this.members.listMembers(ownerId, spaceId);
  }

  @Version('1')
  @Post()
  @RequireSpaceRole(SpaceRole.OWNER, { spaceIdParam: 'spaceId' })
  @ApiOperation({
    summary: 'Add a member to the space',
    description: 'Requires OWNER role in the target space.',
  })
  async add(
    @Req() request: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Body() dto: CreateSpaceMemberDto,
  ): Promise<SpaceMemberResponseDto> {
    const ownerId = this.getUserId(request);
    return this.members.addMember(ownerId, spaceId, dto);
  }

  @Version('1')
  @Patch(':memberId')
  @RequireSpaceRole(SpaceRole.OWNER, { spaceIdParam: 'spaceId' })
  @ApiOperation({
    summary: 'Update a space member role',
    description: 'Requires OWNER role in the target space.',
  })
  async updateRole(
    @Req() request: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() dto: UpdateSpaceMemberDto,
  ): Promise<SpaceMemberResponseDto> {
    const ownerId = this.getUserId(request);
    return this.members.updateMemberRole(ownerId, spaceId, memberId, dto);
  }

  @Version('1')
  @Delete(':memberId')
  @RequireSpaceRole(SpaceRole.OWNER, { spaceIdParam: 'spaceId' })
  @ApiOperation({
    summary: 'Remove a member from the space',
    description: 'Requires OWNER role in the target space.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: RequestWithUser,
    @Param('spaceId', new ParseUUIDPipe()) spaceId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ): Promise<void> {
    const ownerId = this.getUserId(request);
    await this.members.removeMember(ownerId, spaceId, memberId);
  }
}
