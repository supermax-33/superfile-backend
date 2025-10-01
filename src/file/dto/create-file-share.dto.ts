import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFileShareDto {
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  note?: string;
}
