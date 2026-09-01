import { IsBoolean } from 'class-validator';

export class SetClientStatusDto {
  @IsBoolean()
  active!: boolean;
}
