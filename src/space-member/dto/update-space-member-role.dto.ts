import { IsEnum } from 'class-validator';
import { SpaceRole } from '@prisma/client';

export class UpdateSpaceMemberRoleDto {
  @IsEnum(SpaceRole)
  role!: SpaceRole;
}
