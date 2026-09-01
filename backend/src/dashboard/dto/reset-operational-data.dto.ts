import { Equals, IsString } from 'class-validator';

export class ResetOperationalDataDto {
  @IsString()
  @Equals('RESET OPERATIONS')
  confirmation!: string;
}
