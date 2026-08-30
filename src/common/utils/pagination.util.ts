import { PaginationMeta } from '../interfaces/paginated-result.interface';

/**
 * Converts a validated (page, limit) pair into a SQL OFFSET.
 *
 * Assumes page/limit have already been validated
 * (see PaginationQueryDto) - this does not re-clamp them.
 */
export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Builds the standard pagination metadata block
 * returned by every paginated list endpoint.
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPreviousPage: totalPages > 0 && page > 1,
  };
}
