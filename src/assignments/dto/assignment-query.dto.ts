import { IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const ASSIGNMENT_STATUSES = [
  'OPEN',
  'CLAIMED',
  'IN_PROGRESS',
  'SUBMITTED',
  'COMPLETED',
] as const;

export class AssignmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ASSIGNMENT_STATUSES)
  status?: string;
}
