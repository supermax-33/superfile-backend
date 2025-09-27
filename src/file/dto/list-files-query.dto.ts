import { ApiPropertyOptional } from '@nestjs/swagger';
import { FileStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ListFilesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter files belonging to a specific space.',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @ApiPropertyOptional({
    description: 'Filter files by processing status.',
    enum: FileStatus,
  })
  @IsOptional()
  @IsEnum(FileStatus)
  status?: FileStatus;
}
