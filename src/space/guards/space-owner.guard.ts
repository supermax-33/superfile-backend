import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SpaceService } from '../space.service';
import { RequestWithUser } from 'types';

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

    const ownerId = await this.spaceService.getSpaceOwnerId(spaceId);
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
