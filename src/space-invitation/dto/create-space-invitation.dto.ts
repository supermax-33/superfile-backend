import { IsEmail } from 'class-validator';

export class CreateSpaceInvitationDto {
  @IsEmail()
  email!: string;
}
