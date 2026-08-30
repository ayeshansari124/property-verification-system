import { ConflictException, NotFoundException } from '@nestjs/common';

import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';
import { PropertiesRepository } from '../properties/properties.repository';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { SearchQueue } from '../queues/search/search.queue';

describe('ReviewsService', () => {
  let service: ReviewsService;

  let reviewsRepository: jest.Mocked<
    Pick<
      ReviewsRepository,
      | 'findOneWithJoins'
      | 'findForApproval'
      | 'findById'
      | 'transitionFromPending'
      | 'findManyPending'
      | 'countPending'
    >
  >;
  let propertiesRepository: jest.Mocked<
    Pick<PropertiesRepository, 'updateById'>
  >;
  let auditService: jest.Mocked<Pick<AuditService, 'recordChange'>>;
  let searchQueue: jest.Mocked<Pick<SearchQueue, 'addPropertyVerificationJob'>>;
  let databaseService: { db: { transaction: jest.Mock } };

 
  const fakeTx = {} as any;

  beforeEach(() => {
    reviewsRepository = {
      findOneWithJoins: jest.fn(),
      findForApproval: jest.fn(),
      findById: jest.fn(),
      transitionFromPending: jest.fn(),
      findManyPending: jest.fn(),
      countPending: jest.fn(),
    };

    propertiesRepository = {
      updateById: jest.fn(),
    };

    auditService = {
      recordChange: jest.fn(),
    };

    searchQueue = {
      addPropertyVerificationJob: jest.fn(),
    };

    databaseService = {
      db: {
        transaction: jest.fn((callback: (tx: any) => any) => callback(fakeTx)),
      },
    };

    service = new ReviewsService(
      reviewsRepository as unknown as ReviewsRepository,
      propertiesRepository as unknown as PropertiesRepository,
      databaseService as unknown as DatabaseService,
      auditService as unknown as AuditService,
      searchQueue as unknown as SearchQueue,
    );
  });

  describe('findOne', () => {
    it('throws NotFoundException when the review does not exist', async () => {
      reviewsRepository.findOneWithJoins.mockResolvedValue(undefined as any);

      await expect(service.findOne('missing-review-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the review when found', async () => {
      const review = { reviewId: 'review-1', status: 'PENDING' };
      reviewsRepository.findOneWithJoins.mockResolvedValue(review as any);

      await expect(service.findOne('review-1')).resolves.toEqual(review);
    });
  });

  describe('approve', () => {
    it('throws NotFoundException when the review does not exist', async () => {
      reviewsRepository.findForApproval.mockResolvedValue(undefined as any);

      await expect(
        service.approve('missing-review-id', 'reviewer-id'),
      ).rejects.toThrow(NotFoundException);

      expect(propertiesRepository.updateById).not.toHaveBeenCalled();
      expect(auditService.recordChange).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the review was already processed', async () => {
      reviewsRepository.findForApproval.mockResolvedValue({
        review: {
          id: 'review-1',
          status: 'RETURNED',
          newValues: { bathrooms: 4 },
          oldValues: { bathrooms: 3 },
        },
        assignmentPropertyId: 'assignment-property-1',
        propertyId: 'property-1',
      } as any);

      await expect(service.approve('review-1', 'reviewer-id')).rejects.toThrow(
        ConflictException,
      );

      expect(propertiesRepository.updateById).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the proposed values contain no actual changes', async () => {
      reviewsRepository.findForApproval.mockResolvedValue({
        review: {
          id: 'review-1',
          status: 'PENDING',
          newValues: { bathrooms: 3 },
          oldValues: { bathrooms: 3 },
        },
        assignmentPropertyId: 'assignment-property-1',
        propertyId: 'property-1',
      } as any);

      await expect(service.approve('review-1', 'reviewer-id')).rejects.toThrow(
        ConflictException,
      );

      expect(propertiesRepository.updateById).not.toHaveBeenCalled();
    });

    it('updates the property, records an audit entry, and marks the review approved', async () => {
      reviewsRepository.findForApproval.mockResolvedValue({
        review: {
          id: 'review-1',
          status: 'PENDING',
          newValues: { bathrooms: 4 },
          oldValues: { bathrooms: 3 },
        },
        assignmentPropertyId: 'assignment-property-1',
        propertyId: 'property-1',
      } as any);

      propertiesRepository.updateById.mockResolvedValue({
        id: 'property-1',
        bathrooms: 4,
      } as any);

      reviewsRepository.transitionFromPending.mockResolvedValue({
        id: 'review-1',
        status: 'APPROVED',
      } as any);

      const result = await service.approve(
        'review-1',
        'reviewer-id',
        'looks good',
      );

      expect(propertiesRepository.updateById).toHaveBeenCalledWith(
        fakeTx,
        'property-1',
        expect.objectContaining({ bathrooms: 4 }),
      );

      expect(auditService.recordChange).toHaveBeenCalledWith(
        fakeTx,
        expect.objectContaining({
          propertyId: 'property-1',
          userId: 'reviewer-id',
          changedFields: ['bathrooms'],
        }),
      );

      expect(reviewsRepository.transitionFromPending).toHaveBeenCalledWith(
        fakeTx,
        'review-1',
        'APPROVED',
        'reviewer-id',
        'looks good',
      );

      // The search/verification job is only enqueued after the
      // transaction (property update + audit + review transition)
      // has committed.
      expect(searchQueue.addPropertyVerificationJob).toHaveBeenCalledWith(
        'property-1',
      );

      expect(result).toEqual({
        review: { id: 'review-1', status: 'APPROVED' },
        property: { id: 'property-1', bathrooms: 4 },
      });
    });

    it('throws ConflictException if another reviewer already processed it concurrently', async () => {
      reviewsRepository.findForApproval.mockResolvedValue({
        review: {
          id: 'review-1',
          status: 'PENDING',
          newValues: { bathrooms: 4 },
          oldValues: { bathrooms: 3 },
        },
        assignmentPropertyId: 'assignment-property-1',
        propertyId: 'property-1',
      } as any);

      propertiesRepository.updateById.mockResolvedValue({
        id: 'property-1',
        bathrooms: 4,
      } as any);

      // Someone else's request won the race on the conditional UPDATE.
      reviewsRepository.transitionFromPending.mockResolvedValue(
        undefined as any,
      );

      await expect(service.approve('review-1', 'reviewer-id')).rejects.toThrow(
        ConflictException,
      );

      expect(searchQueue.addPropertyVerificationJob).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('throws NotFoundException when the review does not exist', async () => {
      reviewsRepository.findById.mockResolvedValue(undefined as any);

      await expect(
        service.reject('missing-review-id', 'reviewer-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the review was already processed', async () => {
      reviewsRepository.findById.mockResolvedValue({
        id: 'review-1',
        status: 'APPROVED',
      } as any);

      await expect(service.reject('review-1', 'reviewer-id')).rejects.toThrow(
        ConflictException,
      );
    });

    it('transitions a pending review to REJECTED', async () => {
      reviewsRepository.findById.mockResolvedValue({
        id: 'review-1',
        status: 'PENDING',
      } as any);

      reviewsRepository.transitionFromPending.mockResolvedValue({
        id: 'review-1',
        status: 'REJECTED',
      } as any);

      const result = await service.reject(
        'review-1',
        'reviewer-id',
        'bad data',
      );

      expect(reviewsRepository.transitionFromPending).toHaveBeenCalledWith(
        fakeTx,
        'review-1',
        'REJECTED',
        'reviewer-id',
        'bad data',
      );
      expect(result).toEqual({ id: 'review-1', status: 'REJECTED' });
    });
  });

  describe('returnToChecker', () => {
    it('throws ConflictException when the review was already processed', async () => {
      reviewsRepository.findById.mockResolvedValue({
        id: 'review-1',
        status: 'REJECTED',
      } as any);

      await expect(
        service.returnToChecker(
          'review-1',
          'reviewer-id',
          'Please correct the data',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('transitions a pending review to RETURNED', async () => {
      reviewsRepository.findById.mockResolvedValue({
        id: 'review-1',
        status: 'PENDING',
      } as any);

      reviewsRepository.transitionFromPending.mockResolvedValue({
        id: 'review-1',
        status: 'RETURNED',
      } as any);

      const result = await service.returnToChecker(
        'review-1',
        'reviewer-id',
        'Please correct the data',
      );

      expect(result).toEqual({ id: 'review-1', status: 'RETURNED' });
    });
  });
});
