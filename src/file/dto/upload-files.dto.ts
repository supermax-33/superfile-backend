import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UploadFilesDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  spaceId!: string;
}
