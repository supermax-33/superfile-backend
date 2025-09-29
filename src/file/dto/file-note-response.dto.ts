export class FileNoteResponseDto {
  constructor(partial: Partial<FileNoteResponseDto> = {}) {
    Object.assign(this, partial);
  }

  note: string | null = null;
}
