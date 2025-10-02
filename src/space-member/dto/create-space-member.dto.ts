import { ApiProperty } from '@nestjs/swagger';
import { SpaceRole } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateSpaceMemberDto {
  @ApiProperty({ description: 'User identifier to add to the space.' })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    enum: SpaceRole,
    description: 'Role to assign to the user within the space.',
  })
  @IsEnum(SpaceRole)
  role: SpaceRole = SpaceRole.VIEWER;
}
