import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SPACE_SLUG_REGEX } from './create-space.dto';

export class UpdateSpaceDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(SPACE_SLUG_REGEX, {
    message:
      'Slug may only include alphanumeric characters and single hyphens separating segments.',
  })
  slug?: string;
}
