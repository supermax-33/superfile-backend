import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export const SPACE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export class CreateSpaceDto {
  @ApiProperty({
    description:
      'Human-friendly name that will be shown to members and guests.',
    example: 'Product Team',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'URL-safe slug used to identify the space in routes.',
    example: 'product-team',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(SPACE_SLUG_REGEX, {
    message:
      'Slug may only include alphanumeric characters and single hyphens separating segments.',
  })
  slug!: string;
}
