import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { SearchQueue } from '../queues/search/search.queue';
import { AuditService } from '../audit/audit.service';

import {
  getOffset,
  buildPaginationMeta,
} from '../common/utils/pagination.util';
import { diffPropertyValues } from '../common/utils/property-fields.util';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

import { PropertiesRepository } from './properties.repository';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly propertiesRepository: PropertiesRepository,
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly searchQueue: SearchQueue,
  ) {}

  async findAll(
    page: number,
    limit: number,
    filters: { search?: string; city?: string; state?: string },
  ): Promise<PaginatedResult<unknown>> {
    const offset = getOffset(page, limit);

    const [data, total] = await Promise.all([
      this.propertiesRepository.findMany(filters, limit, offset),
      this.propertiesRepository.count(filters),
    ]);

    return {
      data,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string) {
    const property = await this.propertiesRepository.findById(id);

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return property;
  }

  // ADMIN direct override of a property record.
  async update(id: string, dto: UpdatePropertyDto, adminId: string) {
    const db = this.databaseService.db;

    const result = await db.transaction(async (tx) => {
      const existing = await this.propertiesRepository.findById(id, tx);

      if (!existing) {
        throw new NotFoundException('Property not found');
      }

      const { changedFields, oldValues, newValues } = diffPropertyValues(
        existing as unknown as Record<string, unknown>,
        { ...existing, ...dto } as unknown as Record<string, unknown>,
      );

      if (changedFields.length === 0) {
        throw new BadRequestException('No property fields were changed');
      }

      const updatedProperty = await this.propertiesRepository.updateById(
        tx,
        id,
        newValues,
      );

      await this.auditService.recordChange(tx, {
        propertyId: id,
        userId: adminId,
        changedFields,
        oldValues,
        newValues,
      });

      return updatedProperty;
    });
    await this.searchQueue.addPropertyVerificationJob(result.id);

    return result;
  }
}
