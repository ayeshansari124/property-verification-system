import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, ilike, or, SQL } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import {
  assignmentProperties,
  assignments,
  properties,
  propertyReviews,
} from '../database/schema';
import { DbExecutor } from '../common/types/drizzle.types';

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';

export interface ReviewFilters {
  search?: string;
  city?: string;
  state?: string;
}

@Injectable()
export class ReviewsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.db;
  }

  async findPendingByAssignmentProperty(
    executor: DbExecutor,
    assignmentPropertyId: string,
  ) {
    const [review] = await executor
      .select({ id: propertyReviews.id })
      .from(propertyReviews)
      .where(
        and(
          eq(propertyReviews.assignmentPropertyId, assignmentPropertyId),
          eq(propertyReviews.status, 'PENDING'),
        ),
      )
      .limit(1);

    return review;
  }

  async insertReview(
    executor: DbExecutor,
    data: {
      assignmentPropertyId: string;
      checkerId: string;
      oldValues: Record<string, unknown>;
      newValues: Record<string, unknown>;
    },
  ) {
    const [review] = await executor
      .insert(propertyReviews)
      .values({
        assignmentPropertyId: data.assignmentPropertyId,
        checkerId: data.checkerId,
        oldValues: data.oldValues,
        newValues: data.newValues,
        checkerNotes: null,
        status: 'PENDING',
      })
      .returning();

    return review;
  }

  /**
   * Counts PENDING reviews for an assignment. Used to enforce
   * "an assignment cannot be submitted while any property still
   * has a PENDING review".
   */
  async countPendingByAssignmentId(executor: DbExecutor, assignmentId: string) {
    const [result] = await executor
      .select({ count: count() })
      .from(propertyReviews)
      .innerJoin(
        assignmentProperties,
        eq(propertyReviews.assignmentPropertyId, assignmentProperties.id),
      )
      .where(
        and(
          eq(assignmentProperties.assignmentId, assignmentId),
          eq(propertyReviews.status, 'PENDING'),
        ),
      );

    return Number(result?.count ?? 0);
  }

  private buildListWhere(filters: ReviewFilters): SQL {
    const conditions: SQL[] = [eq(propertyReviews.status, 'PENDING')];

    if (filters.search?.trim()) {
      const searchValue = `%${filters.search.trim()}%`;

      const searchCondition = or(
        ilike(properties.address, searchValue),
        ilike(properties.city, searchValue),
        ilike(properties.state, searchValue),
        ilike(properties.zip, searchValue),
        ilike(properties.propertyType, searchValue),
        ilike(assignments.name, searchValue),
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

    return and(...conditions)!;
  }

  async findManyPending(filters: ReviewFilters, limit: number, offset: number) {
    const whereCondition = this.buildListWhere(filters);

    return this.db
      .select({
        reviewId: propertyReviews.id,
        assignmentPropertyId: propertyReviews.assignmentPropertyId,
        checkerId: propertyReviews.checkerId,
        checkerNotes: propertyReviews.checkerNotes,
        reviewerNotes: propertyReviews.reviewerNotes,
        reviewStatus: propertyReviews.status,
        createdAt: propertyReviews.createdAt,

        assignmentId: assignments.id,
        assignmentName: assignments.name,

        propertyId: properties.id,
        address: properties.address,
        city: properties.city,
        state: properties.state,
        zip: properties.zip,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
        propertyType: properties.propertyType,
      })
      .from(propertyReviews)
      .innerJoin(
        assignmentProperties,
        eq(propertyReviews.assignmentPropertyId, assignmentProperties.id),
      )
      .innerJoin(
        assignments,
        eq(assignmentProperties.assignmentId, assignments.id),
      )
      .innerJoin(properties, eq(assignmentProperties.propertyId, properties.id))
      .where(whereCondition)
      .orderBy(asc(propertyReviews.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countPending(filters: ReviewFilters) {
    const whereCondition = this.buildListWhere(filters);

    const [result] = await this.db
      .select({ count: count() })
      .from(propertyReviews)
      .innerJoin(
        assignmentProperties,
        eq(propertyReviews.assignmentPropertyId, assignmentProperties.id),
      )
      .innerJoin(
        assignments,
        eq(assignmentProperties.assignmentId, assignments.id),
      )
      .innerJoin(properties, eq(assignmentProperties.propertyId, properties.id))
      .where(whereCondition);

    return Number(result?.count ?? 0);
  }

  async findOneWithJoins(reviewId: string) {
    const [review] = await this.db
      .select({
        reviewId: propertyReviews.id,
        assignmentPropertyId: propertyReviews.assignmentPropertyId,
        checkerId: propertyReviews.checkerId,
        reviewerId: propertyReviews.reviewerId,
        checkerNotes: propertyReviews.checkerNotes,
        reviewerNotes: propertyReviews.reviewerNotes,
        status: propertyReviews.status,
        oldValues: propertyReviews.oldValues,
        newValues: propertyReviews.newValues,
        createdAt: propertyReviews.createdAt,
        reviewedAt: propertyReviews.reviewedAt,
        assignmentId: assignments.id,
        assignmentName: assignments.name,
        propertyId: properties.id,
      })
      .from(propertyReviews)
      .innerJoin(
        assignmentProperties,
        eq(propertyReviews.assignmentPropertyId, assignmentProperties.id),
      )
      .innerJoin(
        assignments,
        eq(assignmentProperties.assignmentId, assignments.id),
      )
      .innerJoin(properties, eq(assignmentProperties.propertyId, properties.id))
      .where(eq(propertyReviews.id, reviewId))
      .limit(1);

    return review;
  }

  /**
   * Loads a review together with its target property id, for use
   * inside the approval transaction.
   */
  async findForApproval(executor: DbExecutor, reviewId: string) {
    const [result] = await executor
      .select({
        review: propertyReviews,
        assignmentPropertyId: assignmentProperties.id,
        propertyId: assignmentProperties.propertyId,
      })
      .from(propertyReviews)
      .innerJoin(
        assignmentProperties,
        eq(propertyReviews.assignmentPropertyId, assignmentProperties.id),
      )
      .where(eq(propertyReviews.id, reviewId))
      .limit(1);

    return result;
  }

  async findById(executor: DbExecutor, reviewId: string) {
    const [review] = await executor
      .select()
      .from(propertyReviews)
      .where(eq(propertyReviews.id, reviewId))
      .limit(1);

    return review;
  }

  /**
   * Atomically transitions a PENDING review to a terminal status.
   *
   * The `status = 'PENDING'` guard in the WHERE clause is what
   * prevents a reviewer from approving/rejecting the same review
   * twice under concurrent requests.
   */
  async transitionFromPending(
    executor: DbExecutor,
    reviewId: string,
    status: ReviewStatus,
    reviewerId: string,
    reviewerNotes?: string,
  ) {
    const [updated] = await executor
      .update(propertyReviews)
      .set({
        status,
        reviewerId,
        reviewerNotes: reviewerNotes ?? null,
        reviewedAt: new Date(),
      })
      .where(
        and(
          eq(propertyReviews.id, reviewId),
          eq(propertyReviews.status, 'PENDING'),
        ),
      )
      .returning();

    return updated;
  }
}
