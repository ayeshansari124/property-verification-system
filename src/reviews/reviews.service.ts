import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, ilike, or } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { SearchQueue } from '../queues/search.queue';

import {
  assignmentProperties,
  assignments,
  properties,
  propertyReviews,
  auditLogs,
} from '../database/schema';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly searchQueue: SearchQueue,
  ) {}

  async getPendingReviews(
    page = 1,
    limit = 20,
    search?: string,
    city?: string,
    state?: string,
  ) {
    const db = this.databaseService.db;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const conditions = [eq(propertyReviews.status, 'PENDING')];

    if (search?.trim()) {
      const searchValue = `%${search.trim()}%`;

      conditions.push(
        or(
          ilike(properties.address, searchValue),
          ilike(properties.city, searchValue),
          ilike(properties.state, searchValue),
          ilike(properties.zip, searchValue),
          ilike(properties.propertyType, searchValue),
          ilike(assignments.name, searchValue),
        )!,
      );
    }

    if (city?.trim()) {
      conditions.push(ilike(properties.city, `%${city.trim()}%`));
    }

    if (state?.trim()) {
      conditions.push(ilike(properties.state, `%${state.trim()}%`));
    }

    const whereCondition = and(...conditions);

    const reviews = await db
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
      .limit(safeLimit)
      .offset(offset);

    const [totalResult] = await db
      .select({
        count: count(),
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
      .where(whereCondition);

    const total = Number(totalResult?.count ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);

    return {
      data: reviews,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: totalPages > 0 && safePage < totalPages,
        hasPreviousPage: safePage > 1 && totalPages > 0,
      },
    };
  }

  async findOne(reviewId: string) {
    const db = this.databaseService.db;

    const [review] = await db
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

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async approve(reviewId: string, reviewerId: string, reviewerNotes?: string) {
    const db = this.databaseService.db;

    const result = await db.transaction(async (tx) => {
      const [review] = await tx
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

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      if (review.review.status !== 'PENDING') {
        throw new ConflictException(
          `Review has already been ${review.review.status.toLowerCase()}`,
        );
      }

      const proposedValues = review.review.newValues as Record<string, unknown>;

      const oldValues = review.review.oldValues as Record<string, unknown>;

      const allowedFields = [
        'address',
        'city',
        'state',
        'zip',
        'bedrooms',
        'bathrooms',
        'propertyType',
        'yearBuilt',
        'livingArea',
        'lotSize',
        'heating',
        'cooling',
        'water',
        'sewer',
        'appliances',
        'features',
        'listingAgent',
        'buyerAgent',
        'status',
      ] as const;

      const propertyUpdate: Record<string, unknown> = {};
      const changedFields: string[] = [];
      const auditOldValues: Record<string, unknown> = {};
      const auditNewValues: Record<string, unknown> = {};

      for (const field of allowedFields) {
        const oldValue = oldValues[field];
        const newValue = proposedValues[field];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changedFields.push(field);
          propertyUpdate[field] = newValue;
          auditOldValues[field] = oldValue;
          auditNewValues[field] = newValue;
        }
      }

      if (changedFields.length === 0) {
        throw new ConflictException(
          'Review contains no actual property changes',
        );
      }

      const [updatedProperty] = await tx
        .update(properties)
        .set({
          ...propertyUpdate,
          updatedAt: new Date(),
        })
        .where(eq(properties.id, review.propertyId))
        .returning();

      if (!updatedProperty) {
        throw new NotFoundException('Property not found');
      }

      await tx.insert(auditLogs).values({
        propertyId: review.propertyId,
        userId: reviewerId,
        changedFields,
        oldValues: auditOldValues,
        newValues: auditNewValues,
      });

      const [updatedReview] = await tx
        .update(propertyReviews)
        .set({
          status: 'APPROVED',
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

      if (!updatedReview) {
        throw new ConflictException(
          'Review was already processed by another reviewer',
        );
      }

      return {
        review: updatedReview,
        property: updatedProperty,
        propertyId: review.propertyId,
      };
    });

    // Transaction has successfully committed.
    // Only now enqueue external verification.
    await this.searchQueue.addPropertyVerificationJob(result.propertyId);

    return {
      review: result.review,
      property: result.property,
    };
  }

  async reject(reviewId: string, reviewerId: string, reviewerNotes?: string) {
    return this.processWithoutPropertyChange(
      reviewId,
      reviewerId,
      'REJECTED',
      reviewerNotes,
    );
  }

  async returnToChecker(
    reviewId: string,
    reviewerId: string,
    reviewerNotes?: string,
  ) {
    return this.processWithoutPropertyChange(
      reviewId,
      reviewerId,
      'RETURNED',
      reviewerNotes,
    );
  }

  private async processWithoutPropertyChange(
    reviewId: string,
    reviewerId: string,
    status: 'REJECTED' | 'RETURNED',
    reviewerNotes?: string,
  ) {
    const db = this.databaseService.db;

    return db.transaction(async (tx) => {
      const [review] = await tx
        .select()
        .from(propertyReviews)
        .where(eq(propertyReviews.id, reviewId))
        .limit(1);

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      if (review.status !== 'PENDING') {
        throw new ConflictException(
          `Review has already been ${review.status.toLowerCase()}`,
        );
      }

      const [updatedReview] = await tx
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

      if (!updatedReview) {
        throw new ConflictException(
          'Review was already processed by another reviewer',
        );
      }

      return updatedReview;
    });
  }
}
