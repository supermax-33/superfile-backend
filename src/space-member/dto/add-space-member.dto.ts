import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SpaceRole } from '@prisma/client';

export class AddSpaceMemberDto {
  @IsUUID()
  userId!: string;

  @IsEnum(SpaceRole)
  @IsOptional()
  role?: SpaceRole;
}
