import { IsBoolean } from 'class-validator';

export class SetRecurringStatusDto {
  @IsBoolean()
  active!: boolean;
}
