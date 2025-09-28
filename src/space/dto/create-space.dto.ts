import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export const SPACE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export class CreateSpaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(SPACE_SLUG_REGEX, {
    message:
      'Slug may only include alphanumeric characters and single hyphens separating segments.',
  })
  slug!: string;
}
