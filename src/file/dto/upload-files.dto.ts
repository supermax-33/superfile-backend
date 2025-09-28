import { IsUUID } from 'class-validator';

export class UploadFilesDto {
  @IsUUID()
  spaceId!: string;
}
