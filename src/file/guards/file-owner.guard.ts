import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileService } from '../file.service';
import { RequestWithUser } from 'types';

@Injectable()
export class FileOwnerGuard implements CanActivate {
  constructor(private readonly fileService: FileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const fileId = request.params?.id;

    if (!fileId) {
      throw new BadRequestException('File identifier is required.');
    }

    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'You must be authenticated to manage this file.',
      );
    }

    const ownerId = await this.fileService.getFileOwnerId(fileId);
    if (!ownerId) {
      throw new NotFoundException('File not found.');
    }

    if (ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this file.',
      );
    }

    return true;
  }
}
