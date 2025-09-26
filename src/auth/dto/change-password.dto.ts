import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password for the authenticated account.',
    example: 'CurrentP@ss1',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'New password that replaces the current password.',
    example: 'NewStrongerP@ss2',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
