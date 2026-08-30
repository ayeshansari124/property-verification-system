import { Injectable } from '@nestjs/common';
import { desc, eq, count } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { auditLogs } from '../database/schema';
import { DbExecutor } from '../common/types/drizzle.types';

export interface CreateAuditLogInput {
  propertyId: string;
  userId: string;
  changedFields: string[];
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  //  Records one immutable audit entry.
  async insert(executor: DbExecutor, input: CreateAuditLogInput) {
    const [entry] = await executor
      .insert(auditLogs)
      .values({
        propertyId: input.propertyId,
        userId: input.userId,
        changedFields: input.changedFields,
        oldValues: input.oldValues,
        newValues: input.newValues,
      })
      .returning();

    return entry;
  }

  async findByPropertyId(propertyId: string, limit: number, offset: number) {
    const db = this.databaseService.db;

    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.propertyId, propertyId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countByPropertyId(propertyId: string) {
    const db = this.databaseService.db;

    const [result] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(eq(auditLogs.propertyId, propertyId));

    return Number(result?.count ?? 0);
  }
}
