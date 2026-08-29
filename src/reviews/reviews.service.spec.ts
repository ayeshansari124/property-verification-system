import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const mockDatabaseService = {
    db: {
      select: jest.fn(),
      transaction: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewsService(mockDatabaseService as any);
  });

  describe('findOne', () => {
    it('should throw when review does not exist', async () => {
      const limit = jest.fn().mockResolvedValue([]);

      mockDatabaseService.db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit,
                }),
              }),
            }),
          }),
        }),
      });

      await expect(service.findOne('missing-review-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('approve', () => {
    it('should reject approval when review does not exist', async () => {
      mockDatabaseService.db.transaction.mockImplementation(
        async (callback: any) => {
          const tx = {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };

          return callback(tx);
        },
      );

      await expect(
        service.approve('missing-review-id', 'reviewer-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject approval when review is already processed', async () => {
      const processedReview = {
        id: 'review-1',
        status: 'RETURNED',
        newValues: {
          bathrooms: 4,
        },
        oldValues: {
          bathrooms: 3,
        },
      };

      mockDatabaseService.db.transaction.mockImplementation(
        async (callback: any) => {
          const tx = {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([
                      {
                        review: processedReview,
                        assignmentPropertyId: 'assignment-property-1',
                        propertyId: 'property-1',
                      },
                    ]),
                  }),
                }),
              }),
            }),
          };

          return callback(tx);
        },
      );

      await expect(service.approve('review-1', 'reviewer-id')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('reject', () => {
    it('should reject a missing review', async () => {
      mockDatabaseService.db.transaction.mockImplementation(
        async (callback: any) => {
          const tx = {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          };

          return callback(tx);
        },
      );

      await expect(
        service.reject('missing-review-id', 'reviewer-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject processing an already processed review', async () => {
      const review = {
        id: 'review-1',
        status: 'APPROVED',
      };

      mockDatabaseService.db.transaction.mockImplementation(
        async (callback: any) => {
          const tx = {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([review]),
                }),
              }),
            }),
          };

          return callback(tx);
        },
      );

      await expect(service.reject('review-1', 'reviewer-id')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('returnToChecker', () => {
    it('should reject returning an already processed review', async () => {
      const review = {
        id: 'review-1',
        status: 'REJECTED',
      };

      mockDatabaseService.db.transaction.mockImplementation(
        async (callback: any) => {
          const tx = {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([review]),
                }),
              }),
            }),
          };

          return callback(tx);
        },
      );

      await expect(
        service.returnToChecker(
          'review-1',
          'reviewer-id',
          'Please correct the data',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
