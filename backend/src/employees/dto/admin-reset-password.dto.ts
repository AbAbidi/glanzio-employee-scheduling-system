import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(200)
  newPassword!: string;
}
