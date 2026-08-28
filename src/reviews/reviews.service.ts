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
       * Get the pending review together with the
       * assignment-property relationship.
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

      if (review.review.status !== 'PENDING') {
        throw new ConflictException(
          `Review has already been ${review.review.status.toLowerCase()}`,
        );
      }

      /*
       * ONLY NOW do we update the real property.
       *
       * Reviewer approval is the point where the proposed
       * values become the actual property values.
       */
      const proposedValues = review.review.newValues as Record<string, unknown>;

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

      for (const field of allowedFields) {
        if (proposedValues[field] !== undefined) {
          propertyUpdate[field] = proposedValues[field];
        }
      }

      if (Object.keys(propertyUpdate).length === 0) {
        throw new ConflictException('Review contains no property changes');
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

      /*
       * Mark the review as APPROVED only after the
       * property update succeeds.
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

      /*
       * REJECT and RETURN never touch the properties table.
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
