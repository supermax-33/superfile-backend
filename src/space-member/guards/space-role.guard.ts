import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from 'types';
import {
  SPACE_ROLE_METADATA_KEY,
  SpaceRoleMetadata,
} from '../decorators/require-space-role.decorator';
import { SpaceMemberService } from '../space-member.service';

@Injectable()
export class SpaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly members: SpaceMemberService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.getMetadata(context);
    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user context is required to access this resource.',
      );
    }

    const spaceId = await this.resolveSpaceId(request, metadata);

    await this.members.assertRoleForSpace(userId, spaceId, metadata.role);

    return true;
  }

  private getMetadata(context: ExecutionContext): SpaceRoleMetadata | undefined {
    return (
      this.reflector.get<SpaceRoleMetadata>(
        SPACE_ROLE_METADATA_KEY,
        context.getHandler(),
      ) ??
      this.reflector.get<SpaceRoleMetadata>(
        SPACE_ROLE_METADATA_KEY,
        context.getClass(),
      )
    );
  }

  private async resolveSpaceId(
    request: RequestWithUser,
    metadata: SpaceRoleMetadata,
  ): Promise<string> {
    const { options } = metadata;
    const params = request.params ?? {};
    const query = request.query ?? {};
    const body = request.body ?? {};

    const paramKey = options?.spaceIdParam ?? 'spaceId';
    if (paramKey && typeof params[paramKey] === 'string') {
      return params[paramKey];
    }

    const queryKey = options?.spaceIdQuery;
    const queryValue = queryKey
      ? this.normalizeValue(query[queryKey])
      : undefined;
    if (queryValue) {
      return queryValue;
    }

    const bodyField = options?.spaceIdBodyField;
    if (bodyField) {
      const bodyValue = this.extractFromBody(body, bodyField);
      if (bodyValue) {
        return bodyValue;
      }
    }

    const fileIdParam = options?.fileIdParam;
    if (fileIdParam) {
      const fileId = this.normalizeValue(params[fileIdParam]);
      if (fileId) {
        return this.members.getSpaceIdForFile(fileId);
      }
    }

    const conversationIdParam = options?.conversationIdParam;
    if (conversationIdParam) {
      const conversationId = this.normalizeValue(
        params[conversationIdParam],
      );
      if (conversationId) {
        return this.members.getSpaceIdForConversation(conversationId);
      }
    }

    const reminderIdParam = options?.reminderIdParam;
    if (reminderIdParam) {
      const reminderId = this.normalizeValue(params[reminderIdParam]);
      if (reminderId) {
        return this.members.getSpaceIdForReminder(reminderId);
      }
    }

    throw new BadRequestException(
      'Space identifier could not be determined for this request.',
    );
  }

  private normalizeValue(value: unknown): string | undefined {
    if (!value) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return typeof value[0] === 'string' ? value[0] : undefined;
    }

    return typeof value === 'string' ? value : undefined;
  }

  private extractFromBody(body: unknown, field: string): string | undefined {
    if (!body || typeof body !== 'object') {
      return undefined;
    }

    const segments = field.split('.');
    let current: any = body;

    for (const segment of segments) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      current = current[segment];
    }

    return this.normalizeValue(current);
  }
}
