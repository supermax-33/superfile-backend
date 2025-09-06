import { Length, IsNumberString } from 'class-validator';

export class VerifyEmailDto {
  @IsNumberString()
  @Length(6, 6)
  code: string;
}
