import { Injectable } from '@nestjs/common';
import { and, asc, count, ilike, or, SQL } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { properties } from '../database/schema';
import { DbExecutor } from '../common/types/drizzle.types';

export interface PropertyFilters {
  search?: string;
  city?: string;
  state?: string;
}

@Injectable()
export class PropertiesRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private buildWhere(filters: PropertyFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.search?.trim()) {
      const searchValue = `%${filters.search.trim()}%`;

      const searchCondition = or(
        ilike(properties.address, searchValue),
        ilike(properties.city, searchValue),
        ilike(properties.state, searchValue),
        ilike(properties.zip, searchValue),
        ilike(properties.propertyType, searchValue),
      );

      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (filters.city?.trim()) {
      conditions.push(ilike(properties.city, `%${filters.city.trim()}%`));
    }

    if (filters.state?.trim()) {
      conditions.push(ilike(properties.state, `%${filters.state.trim()}%`));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async findMany(filters: PropertyFilters, limit: number, offset: number) {
    const db = this.databaseService.db;
    const whereCondition = this.buildWhere(filters);

    return db
      .select()
      .from(properties)
      .where(whereCondition)
      .orderBy(asc(properties.address))
      .limit(limit)
      .offset(offset);
  }

  async count(filters: PropertyFilters) {
    const db = this.databaseService.db;
    const whereCondition = this.buildWhere(filters);

    const [result] = await db
      .select({ count: count() })
      .from(properties)
      .where(whereCondition);

    return Number(result?.count ?? 0);
  }

  async findById(id: string, executor: DbExecutor = this.databaseService.db) {
    const [property] = await executor
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);

    return property;
  }

  async updateById(
    executor: DbExecutor,
    id: string,
    values: Record<string, unknown>,
  ) {
    const [updated] = await executor
      .update(properties)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, id))
      .returning();

    return updated;
  }
}
