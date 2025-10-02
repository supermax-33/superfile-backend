import { SpaceRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateSpaceInvitationRoleDto {
  @IsEnum(SpaceRole)
  role!: SpaceRole;
}
