import { ApiProperty } from '@nestjs/swagger';
import { SpaceRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateSpaceMemberDto {
  @ApiProperty({
    enum: SpaceRole,
    description: 'Updated role for the member within the space.',
  })
  @IsEnum(SpaceRole)
  role!: SpaceRole;
}
