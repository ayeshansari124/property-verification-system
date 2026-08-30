import { Injectable } from '@nestjs/common';

import { DbExecutor } from '../common/types/drizzle.types';
import {
  getOffset,
  buildPaginationMeta,
} from '../common/utils/pagination.util';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

import { AuditRepository, CreateAuditLogInput } from './audit.repository';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  /**
   * Records a property change.
   *
   * Callers (ReviewsService on approval, PropertiesService on a
   * direct admin edit) pass the active transaction so the audit
   * entry and the property update commit atomically - nothing
   * should ever be overwritten without history.
   */
  async recordChange(executor: DbExecutor, input: CreateAuditLogInput) {
    return this.auditRepository.insert(executor, input);
  }

  async getHistory(
    propertyId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<unknown>> {
    const offset = getOffset(page, limit);

    const [data, total] = await Promise.all([
      this.auditRepository.findByPropertyId(propertyId, limit, offset),
      this.auditRepository.countByPropertyId(propertyId),
    ]);

    return {
      data,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }
}
