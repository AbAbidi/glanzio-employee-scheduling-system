import { IsBoolean } from 'class-validator';

export class SetSiteStatusDto {
  @IsBoolean()
  active!: boolean;
}
