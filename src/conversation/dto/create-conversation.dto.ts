import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional({
    description: 'Optional title that helps identify the conversation',
    maxLength: 255,
    example: 'Quarterly financial review',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
