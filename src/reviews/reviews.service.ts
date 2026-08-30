import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { SearchQueue } from '../queues/search/search.queue';
import { AuditService } from '../audit/audit.service';
import { PropertiesRepository } from '../properties/properties.repository';

import {
  buildPaginationMeta,
  getOffset,
} from '../common/utils/pagination.util';
import { diffPropertyValues } from '../common/utils/property-fields.util';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

import { ReviewsRepository, ReviewFilters } from './reviews.repository';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly propertiesRepository: PropertiesRepository,
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly searchQueue: SearchQueue,
  ) {}

  async getPendingReviews(
    page: number,
    limit: number,
    filters: ReviewFilters,
  ): Promise<PaginatedResult<unknown>> {
    const offset = getOffset(page, limit);

    const [data, total] = await Promise.all([
      this.reviewsRepository.findManyPending(filters, limit, offset),
      this.reviewsRepository.countPending(filters),
    ]);

    return {
      data,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(reviewId: string) {
    const review = await this.reviewsRepository.findOneWithJoins(reviewId);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  /**
   * REVIEWER approves a pending review.
   *
   * This is the only place the master `properties` table is
   * updated as a result of the checker/reviewer workflow, and it
   * always happens together with an audit log entry in the same
   * transaction - nothing is overwritten without history.
   */
  async approve(reviewId: string, reviewerId: string, reviewerNotes?: string) {
    const db = this.databaseService.db;

    const result = await db.transaction(async (tx) => {
      const found = await this.reviewsRepository.findForApproval(tx, reviewId);

      if (!found) {
        throw new NotFoundException('Review not found');
      }

      if (found.review.status !== 'PENDING') {
        throw new ConflictException(
          `Review has already been ${found.review.status.toLowerCase()}`,
        );
      }

      const proposedValues = found.review.newValues as Record<string, unknown>;
      const previousValues = found.review.oldValues as Record<string, unknown>;

      const { changedFields, oldValues, newValues } = diffPropertyValues(
        previousValues,
        proposedValues,
      );

      if (changedFields.length === 0) {
        throw new ConflictException(
          'Review contains no actual property changes',
        );
      }

      const updatedProperty = await this.propertiesRepository.updateById(
        tx,
        found.propertyId,
        newValues,
      );

      if (!updatedProperty) {
        throw new NotFoundException('Property not found');
      }

      await this.auditService.recordChange(tx, {
        propertyId: found.propertyId,
        userId: reviewerId,
        changedFields,
        oldValues,
        newValues,
      });

      const updatedReview = await this.reviewsRepository.transitionFromPending(
        tx,
        reviewId,
        'APPROVED',
        reviewerId,
        reviewerNotes,
      );

      if (!updatedReview) {
        throw new ConflictException(
          'Review was already processed by another reviewer',
        );
      }

      return {
        review: updatedReview,
        property: updatedProperty,
        propertyId: found.propertyId,
      };
    });

    // Transaction has committed - only now enqueue verification.
    await this.searchQueue.addPropertyVerificationJob(result.propertyId);

    return {
      review: result.review,
      property: result.property,
    };
  }

  async reject(reviewId: string, reviewerId: string, reviewerNotes?: string) {
    return this.transitionWithoutPropertyChange(
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
    return this.transitionWithoutPropertyChange(
      reviewId,
      reviewerId,
      'RETURNED',
      reviewerNotes,
    );
  }

  private async transitionWithoutPropertyChange(
    reviewId: string,
    reviewerId: string,
    status: 'REJECTED' | 'RETURNED',
    reviewerNotes?: string,
  ) {
    const db = this.databaseService.db;

    return db.transaction(async (tx) => {
      const review = await this.reviewsRepository.findById(tx, reviewId);

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      if (review.status !== 'PENDING') {
        throw new ConflictException(
          `Review has already been ${review.status.toLowerCase()}`,
        );
      }

      const updatedReview = await this.reviewsRepository.transitionFromPending(
        tx,
        reviewId,
        status,
        reviewerId,
        reviewerNotes,
      );

      if (!updatedReview) {
        throw new ConflictException(
          'Review was already processed by another reviewer',
        );
      }

      return updatedReview;
    });
  }
}
