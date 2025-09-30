import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UploadFilesDto {
  @IsUUID()
  spaceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
