import { Length, IsNumberString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @IsNumberString()
  @Length(6, 6)
  @IsNotEmpty()
  code: string;
}
