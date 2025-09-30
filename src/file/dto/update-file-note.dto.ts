import { IsString, MaxLength } from 'class-validator';

export class UpdateFileNoteDto {
  @IsString()
  @MaxLength(2000)
  note!: string;
}
