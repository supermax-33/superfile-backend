import { SpaceRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export class CreateSpaceInvitationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(SpaceRole)
  role?: SpaceRole;
}
