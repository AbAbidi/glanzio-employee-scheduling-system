import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  @Matches(/[A-Z]/, {
    message: 'newPassword must contain an uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'newPassword must contain a lowercase letter',
  })
  @Matches(/\d/, { message: 'newPassword must contain a number' })
  @Matches(/[^A-Za-z0-9\s]/, {
    message: 'newPassword must contain a special character',
  })
  newPassword!: string;
}
