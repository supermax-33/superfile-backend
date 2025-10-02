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
    const requiredRole = this.reflector.getAllAndOverride<
      SpaceRole | undefined
    >(SPACE_ROLE_METADATA, [context.getHandler(), context.getClass()]);

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

    const roleContext = this.reflector.getAllAndOverride<
      SpaceRoleContext | undefined
    >(SPACE_ROLE_CONTEXT_METADATA, [context.getHandler(), context.getClass()]);

    if (!roleContext) {
      throw new BadRequestException(
        'Space role guard context is not configured for this route.',
      );
    }

    const spaceId = await this.resolveSpaceId(roleContext, request);

    if (spaceId === undefined) {
      return true;
    }

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
  ): Promise<string | null | undefined> {
    switch (context.source) {
      case 'param':
        return request.params?.[context.key] ?? null;
      case 'body':
        return this.extractBodyValue(request, context.key);
      case 'query':
        return this.extractQueryValue(request.query?.[context.key]);
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

  private extractQueryValue(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      const firstString = value.find(
        (item): item is string => typeof item === 'string',
      );

      if (firstString) {
        return firstString;
      }
    }

    return null;
  }

  private extractBodyValue(
    request: RequestWithUser,
    key: string,
  ): string | null | undefined {
    const value = request.body?.[key];

    if (value === undefined && this.isMultipartForm(request)) {
      return undefined;
    }

    if (value === undefined) {
      return null;
    }

    return this.extractQueryValue(value);
  }

  private isMultipartForm(request: RequestWithUser): boolean {
    const contentType = request.headers['content-type'];
    if (typeof contentType !== 'string') {
      return false;
    }

    return contentType.toLowerCase().includes('multipart/form-data');
  }
}
