import { SpaceRole } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateSpaceMemberDto {
  @IsUUID()
  userId!: string;

  @IsEnum(SpaceRole)
  role: SpaceRole = SpaceRole.VIEWER;
}
