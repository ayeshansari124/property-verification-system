import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { AssignmentQueue } from '../queues/assignment/assignment.queue';
import { PropertiesRepository } from '../properties/properties.repository';
import { ReviewsRepository } from '../reviews/reviews.repository';

import {
  buildPaginationMeta,
  getOffset,
} from '../common/utils/pagination.util';
import { buildProposedValues } from '../common/utils/property-fields.util';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

import { AssignmentsRepository } from './assignments.repository';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdatePropertyDto } from '../properties/dto/update-property.dto';

const CHECKER_EDITABLE_STATUSES = ['CLAIMED', 'IN_PROGRESS'] as const;

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly reviewsRepository: ReviewsRepository,
    private readonly propertiesRepository: PropertiesRepository,
    private readonly assignmentQueue: AssignmentQueue,
    private readonly databaseService: DatabaseService,
  ) {}

  //  ADMIN creates a new assignment. New assignments always start as OPEN.
  async create(dto: CreateAssignmentDto, adminId: string) {
    const db = this.databaseService.db;

    const result = await db.transaction(async (tx) => {
      const existingIds =
        await this.assignmentsRepository.findExistingPropertyIds(
          tx,
          dto.propertyIds,
        );

      if (existingIds.length !== dto.propertyIds.length) {
        throw new BadRequestException('One or more property IDs do not exist');
      }

      const assignment = await this.assignmentsRepository.insertAssignment(tx, {
        name: dto.name,
        totalProperties: dto.propertyIds.length,
        createdBy: adminId,
      });

      await this.assignmentsRepository.insertAssignmentProperties(
        tx,
        assignment.id,
        dto.propertyIds,
      );

      return assignment;
    });

    // Enqueue only after the transaction has committed.
    await this.assignmentQueue.addAssignmentStatsJob(result.id);

    return result;
  }

  //  DATA_CHECKER claims an OPEN assignment. OPEN -> CLAIMED.
  async claim(assignmentId: string, checkerId: string) {
    const claimed = await this.assignmentsRepository.claimOpenAssignment(
      assignmentId,
      checkerId,
    );

    if (claimed) {
      return claimed;
    }

    const existing = await this.assignmentsRepository.findById(assignmentId);

    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }

    throw new ConflictException(
      `Assignment cannot be claimed because it is already ${existing.status}`,
    );
  }

  //DATA_CHECKER starts working on their assignment. CLAIMED -> IN_PROGRESS.
  async start(assignmentId: string, checkerId: string) {
    const started = await this.assignmentsRepository.startClaimedAssignment(
      assignmentId,
      checkerId,
    );

    if (started) {
      return started;
    }

    const existing = await this.assignmentsRepository.findById(assignmentId);

    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }

    if (existing.checkerId !== checkerId) {
      throw new ForbiddenException('You are not assigned to this assignment');
    }

    throw new ConflictException(
      `Assignment cannot be started because it is ${existing.status}`,
    );
  }

  //DATA_CHECKER proposes a property change.
  async updateProperty(
    assignmentId: string,
    propertyId: string,
    checkerId: string,
    dto: UpdatePropertyDto,
  ) {
    const db = this.databaseService.db;

    return db.transaction(async (tx) => {
      const assignment = await this.assignmentsRepository.findOwnedInStatuses(
        tx,
        assignmentId,
        checkerId,
        [...CHECKER_EDITABLE_STATUSES],
      );

      if (!assignment) {
        throw new NotFoundException(
          'Assignment not found, not claimed by you, or not available for editing',
        );
      }

      const assignmentProperty =
        await this.assignmentsRepository.findAssignmentProperty(
          tx,
          assignmentId,
          propertyId,
        );

      if (!assignmentProperty) {
        throw new NotFoundException(
          'Property does not belong to this assignment',
        );
      }

      const existingProperty = await this.propertiesRepository.findById(
        propertyId,
        tx,
      );

      if (!existingProperty) {
        throw new NotFoundException('Property not found');
      }

      const oldValues = { ...existingProperty } as Record<string, unknown>;

      const { newValues, changedFields } = buildProposedValues(
        oldValues,
        dto as Record<string, unknown>,
      );

      if (changedFields.length === 0) {
        throw new BadRequestException('No property fields were provided');
      }

      // Don't allow multiple PENDING reviews for the same property within this assignment.
      const existingPendingReview =
        await this.reviewsRepository.findPendingByAssignmentProperty(
          tx,
          assignmentProperty.id,
        );

      if (existingPendingReview) {
        throw new ConflictException(
          'This property already has a pending review',
        );
      }

      const review = await this.reviewsRepository.insertReview(tx, {
        assignmentPropertyId: assignmentProperty.id,
        checkerId,
        oldValues,
        newValues,
      });

      // DO NOT write to audit_logs here - this is only a proposal.
      // The actual property change is recorded when a reviewer approves it.

      return {
        assignmentId,
        propertyId,
        reviewId: review.id,
        status: review.status,
        changedFields,
        oldValues,
        newValues,
      };
    });
  }

  // DATA_CHECKER submits their assignment. IN_PROGRESS -> SUBMITTED.
  async submit(assignmentId: string, checkerId: string) {
    const db = this.databaseService.db;

    return db.transaction(async (tx) => {
      const assignment = await this.assignmentsRepository.findOwnedByChecker(
        tx,
        assignmentId,
        checkerId,
      );

      if (!assignment) {
        throw new NotFoundException(
          'Assignment not found or not assigned to you',
        );
      }

      if (assignment.status !== 'IN_PROGRESS') {
        throw new ConflictException(
          `Assignment cannot be submitted because it is ${assignment.status}`,
        );
      }

      const pendingCount =
        await this.reviewsRepository.countPendingByAssignmentId(
          tx,
          assignmentId,
        );

      if (pendingCount > 0) {
        throw new ConflictException(
          `Assignment cannot be submitted because ${pendingCount} property review(s) are still pending`,
        );
      }

      const submitted =
        await this.assignmentsRepository.submitInProgressAssignment(
          tx,
          assignmentId,
          checkerId,
        );

      if (!submitted) {
        throw new ConflictException(
          'Assignment was already submitted or changed by another request',
        );
      }

      return submitted;
    });
  }

  // ADMIN or REVIEWER completes a submitted assignment. SUBMITTED -> COMPLETED.
  async complete(assignmentId: string) {
    const completed =
      await this.assignmentsRepository.completeSubmittedAssignment(
        assignmentId,
      );

    if (completed) {
      return completed;
    }

    const existing = await this.assignmentsRepository.findById(assignmentId);

    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }

    throw new ConflictException(
      `Assignment cannot be completed because it is ${existing.status}`,
    );
  }

  // Paginated assignment list. ADMIN, DATA_CHECKER and REVIEWER can view.
  async findAll(
    page: number,
    limit: number,
    status?: string,
  ): Promise<PaginatedResult<unknown>> {
    const offset = getOffset(page, limit);

    const [data, total] = await Promise.all([
      this.assignmentsRepository.findMany(limit, offset, status),
      this.assignmentsRepository.count(status),
    ]);

    return {
      data,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  // One assignment together with its assigned properties.
  async findOne(assignmentId: string, userId: string, userRole: string) {
    const assignment = await this.assignmentsRepository.findById(assignmentId);

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (userRole === 'DATA_CHECKER' && assignment.checkerId !== userId) {
      throw new ForbiddenException('You are not assigned to this assignment');
    }

    const assignedProperties =
      await this.assignmentsRepository.findAssignedProperties(assignmentId);

    return {
      ...assignment,
      properties: assignedProperties,
    };
  }
}
