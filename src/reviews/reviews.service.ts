import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';

import {
  assignmentProperties,
  assignments,
  properties,
  propertyReviews,
  auditLogs,
} from '../database/schema';

@Injectable()
export class ReviewsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getPendingReviews() {
    const db = this.databaseService.db;

    return db
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
      .where(eq(propertyReviews.status, 'PENDING'));
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

    return db.transaction(async (tx) => {
      /*
       * 1. Get the review together with the
       *    assignment-property relationship.
       */
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

      /*
       * 2. Only PENDING reviews can be approved.
       */
      if (review.review.status !== 'PENDING') {
        throw new ConflictException(
          `Review has already been ${review.review.status.toLowerCase()}`,
        );
      }

      /*
       * 3. Read the proposed property values.
       */
      const proposedValues = review.review.newValues as Record<string, unknown>;

      /*
       * 4. Only these fields are allowed to be
       *    written to the properties table.
       */
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

      /*
       * 5. Build the actual property update.
       */
      const propertyUpdate: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (proposedValues[field] !== undefined) {
          propertyUpdate[field] = proposedValues[field];
        }
      }

      if (Object.keys(propertyUpdate).length === 0) {
        throw new ConflictException('Review contains no property changes');
      }

      /*
       * 6. Update the real property.
       *
       * This happens ONLY because the reviewer approved
       * the pending proposal.
       */
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

      /*
       * 7. Build a precise audit record.
       *
       * Only fields whose values actually changed are
       * included in the audit log.
       */
      const oldValues = review.review.oldValues as Record<string, unknown>;

      const newValues = review.review.newValues as Record<string, unknown>;

      const changedFields: string[] = [];

      const auditOldValues: Record<string, unknown> = {};

      const auditNewValues: Record<string, unknown> = {};

      for (const field of allowedFields) {
        const oldValue = oldValues[field];
        const newValue = newValues[field];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changedFields.push(field);
          auditOldValues[field] = oldValue;
          auditNewValues[field] = newValue;
        }
      }

      /*
       * There should always be at least one changed field
       * for a valid review.
       */
      if (changedFields.length === 0) {
        throw new ConflictException(
          'Review contains no actual property changes',
        );
      }

      /*
       * 8. Record the APPROVED change in the audit log.
       *
       * Example:
       *
       * changedFields = ["bedrooms"]
       * oldValues     = { bedrooms: 5 }
       * newValues     = { bedrooms: 6 }
       */
      await tx.insert(auditLogs).values({
        propertyId: review.propertyId,
        userId: reviewerId,
        changedFields,
        oldValues: auditOldValues,
        newValues: auditNewValues,
      });

      /*
       * 9. Mark the review as APPROVED.
       *
       * The property update, audit log and review status
       * all happen inside the same transaction.
       */
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
      };
    });
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
      /*
       * 1. Find the review.
       */
      const [review] = await tx
        .select()
        .from(propertyReviews)
        .where(eq(propertyReviews.id, reviewId))
        .limit(1);

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      /*
       * 2. Only PENDING reviews can be rejected
       *    or returned.
       */
      if (review.status !== 'PENDING') {
        throw new ConflictException(
          `Review has already been ${review.status.toLowerCase()}`,
        );
      }

      /*
       * 3. REJECT and RETURN do NOT modify the
       *    actual properties table.
       */
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
