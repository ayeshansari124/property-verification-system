import { IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class PropertyQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;
}
