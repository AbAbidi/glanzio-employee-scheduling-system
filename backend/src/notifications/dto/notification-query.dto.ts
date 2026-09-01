import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { optionalBoolean } from '../../common/transforms/input.transforms';

export class NotificationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  unreadOnly?: boolean;
}
