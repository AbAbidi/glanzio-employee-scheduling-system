import { IsOptional, Matches } from 'class-validator';

export class ArchiveAnalysisQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}
