import { SpaceRole } from '@prisma/client';

export class SpaceMemberUserDto {
  constructor(partial: Partial<SpaceMemberUserDto> = {}) {
    Object.assign(this, partial);
  }

  id!: string;
  email!: string;
  displayName: string | null = null;
}

export class SpaceMemberResponseDto {
  constructor(partial: Partial<SpaceMemberResponseDto> = {}) {
    Object.assign(this, partial);
  }

  id!: string;
  spaceId!: string;
  userId!: string;
  role!: SpaceRole;
  createdAt!: Date;
  updatedAt!: Date;
  user!: SpaceMemberUserDto;
}
