import { ApiProperty } from '@nestjs/swagger';

export class UpdateSpaceLogoDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'Image file (PNG, JPEG, SVG, etc.) representing the space logo.',
  })
  file!: string;
}
