import { Equals, IsString } from 'class-validator';

export class ResetTestWorkspaceDto {
  @IsString()
  @Equals('RESET TEST WORKSPACE')
  confirmation!: string;
}
