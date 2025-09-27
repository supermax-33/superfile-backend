import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UploadFilesDto {
  @ApiProperty({
    description: 'Identifier of the space the uploaded files will belong to.',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @IsUUID()
  spaceId!: string;
}
