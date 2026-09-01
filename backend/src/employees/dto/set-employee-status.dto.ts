import { IsBoolean } from 'class-validator';

export class SetEmployeeStatusDto {
  @IsBoolean()
  active!: boolean;
}
