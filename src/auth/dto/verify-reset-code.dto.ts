import { IsNumberString, Length } from 'class-validator';

export class VerifyResetCodeDto {
  @IsNumberString()
  @Length(6, 6)
  code: string;
}
