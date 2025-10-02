import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SpaceRole } from '@prisma/client';
import { RequestWithUser } from 'types';
import {
  SPACE_ROLE_CONTEXT_METADATA,
  SPACE_ROLE_METADATA,
  SpaceRoleContext,
} from '../decorators/space-role.decorator';
import { SpaceMemberService } from '../space-member.service';

@Injectable()
export class SpaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly spaceMembers: SpaceMemberService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<SpaceRole | undefined>(
      SPACE_ROLE_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException(
        'You must be authenticated to access this resource.',
      );
    }

    const roleContext = this.reflector.getAllAndOverride<SpaceRoleContext | undefined>(
      SPACE_ROLE_CONTEXT_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!roleContext) {
      throw new BadRequestException(
        'Space role guard context is not configured for this route.',
      );
    }

    const spaceId = await this.resolveSpaceId(roleContext, request);

    if (!spaceId) {
      throw new BadRequestException('Space identifier is required.');
    }

    const membership = await this.spaceMembers.assertRole(
      spaceId,
      userId,
      requiredRole,
    );

    request.spaceMembership = membership;

    return true;
  }

  private async resolveSpaceId(
    context: SpaceRoleContext,
    request: RequestWithUser,
  ): Promise<string | null> {
    switch (context.source) {
      case 'param':
        return request.params?.[context.key] ?? null;
      case 'body':
        return request.body?.[context.key] ?? null;
      case 'query':
        return request.query?.[context.key] ?? null;
      case 'file': {
        const fileId = request.params?.[context.param];
        if (!fileId) {
          return null;
        }
        return this.spaceMembers.getSpaceIdForFile(fileId);
      }
      case 'conversation': {
        const conversationId = request.params?.[context.param];
        if (!conversationId) {
          return null;
        }
        return this.spaceMembers.getSpaceIdForConversation(conversationId);
      }
      case 'reminder': {
        const reminderId = request.params?.[context.param];
        if (!reminderId) {
          return null;
        }
        return this.spaceMembers.getSpaceIdForReminder(reminderId);
      }
      default:
        return null;
    }
  }
}
