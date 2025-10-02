import { SpaceRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateSpaceMemberDto {
  @IsEnum(SpaceRole)
  role!: SpaceRole;
}
