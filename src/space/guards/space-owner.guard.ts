import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SpaceService } from '../space.service';

interface RequestWithUser extends Request {
  user?: {
    userId: string;
  };
}

@Injectable()
export class SpaceOwnerGuard implements CanActivate {
  constructor(private readonly spaceService: SpaceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const spaceId = request.params?.id;

    if (!spaceId) {
      throw new BadRequestException('Space identifier is required.');
    }

    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'You must be authenticated to manage this space.',
      );
    }

    const ownerId = await this.spaceService.getOwnerId(spaceId);
    if (!ownerId) {
      throw new NotFoundException('Space not found.');
    }

    if (ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to manage this space.',
      );
    }

    return true;
  }
}
