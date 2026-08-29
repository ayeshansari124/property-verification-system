import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { and, asc, count, eq, inArray } from 'drizzle-orm';

import { AssignmentQueue } from '../queues/assignment.queue';
import { DatabaseService } from '../database/database.service';

import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

import {
  assignmentProperties,
  assignments,
  properties,
  propertyReviews,
} from '../database/schema';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly assignmentQueue: AssignmentQueue,
    private readonly databaseService: DatabaseService,
  ) {}

  // ============================================================
  // CREATE
  // ============================================================

  /**
   * ADMIN creates a new assignment.
   *
   * New assignments always start as OPEN.
   */
  async create(dto: CreateAssignmentDto, adminId: string) {
    const db = this.databaseService.db;

    const result = await db.transaction(async (tx) => {
      /*
       * Make sure every requested property exists.
       */
      const selectedProperties = await tx
        .select({
          id: properties.id,
        })
        .from(properties)
        .where(inArray(properties.id, dto.propertyIds));

      if (selectedProperties.length !== dto.propertyIds.length) {
        throw new BadRequestException('One or more property IDs do not exist');
      }

      /*
       * Create the assignment.
       */
      const [assignment] = await tx
        .insert(assignments)
        .values({
          name: dto.name,
          totalProperties: dto.propertyIds.length,
          status: 'OPEN',
          createdBy: adminId,
        })
        .returning();

      /*
       * Attach properties to the assignment.
       */
      await tx.insert(assignmentProperties).values(
        dto.propertyIds.map((propertyId) => ({
          assignmentId: assignment.id,
          propertyId,
        })),
      );

      return assignment;
    });

    /*
     * Keep the existing queue behavior.
     */
    await this.assignmentQueue.addAssignmentStatsJob(result.id);

    return result;
  }

  // ============================================================
  // CLAIM
  // ============================================================

  /**
   * DATA_CHECKER claims an OPEN assignment.
   *
   * OPEN -> CLAIMED
   */
  async claim(assignmentId: string, checkerId: string) {
    const db = this.databaseService.db;

    const [claimedAssignment] = await db
      .update(assignments)
      .set({
        status: 'CLAIMED',
        checkerId,
        claimedAt: new Date(),
      })
      .where(
        and(eq(assignments.id, assignmentId), eq(assignments.status, 'OPEN')),
      )
      .returning();

    if (!claimedAssignment) {
      const [existingAssignment] = await db
        .select({
          id: assignments.id,
          status: assignments.status,
        })
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);

      if (!existingAssignment) {
        throw new NotFoundException('Assignment not found');
      }

      throw new ConflictException(
        `Assignment cannot be claimed because it is already ${existingAssignment.status}`,
      );
    }

    return claimedAssignment;
  }

  // ============================================================
  // START
  // ============================================================

  /**
   * DATA_CHECKER starts working on their assignment.
   *
   * CLAIMED -> IN_PROGRESS
   */
  async start(assignmentId: string, checkerId: string) {
    const db = this.databaseService.db;

    const [startedAssignment] = await db
      .update(assignments)
      .set({
        status: 'IN_PROGRESS',
      })
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.checkerId, checkerId),
          eq(assignments.status, 'CLAIMED'),
        ),
      )
      .returning();

    if (!startedAssignment) {
      const [existingAssignment] = await db
        .select({
          id: assignments.id,
          status: assignments.status,
          checkerId: assignments.checkerId,
        })
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);

      if (!existingAssignment) {
        throw new NotFoundException('Assignment not found');
      }

      if (existingAssignment.checkerId !== checkerId) {
        throw new ForbiddenException('You are not assigned to this assignment');
      }

      throw new ConflictException(
        `Assignment cannot be started because it is ${existingAssignment.status}`,
      );
    }

    return startedAssignment;
  }

  // ============================================================
  // UPDATE PROPERTY / CREATE REVIEW
  // ============================================================

  /**
   * DATA_CHECKER proposes a property change.
   *
   * IMPORTANT:
   *
   * The actual properties table is NOT modified here.
   *
   * The proposed values are stored in
   * propertyReviews.newValues.
   *
   * The real property is changed only when
   * a reviewer approves the review.
   */
  async updateProperty(
    assignmentId: string,
    propertyId: string,
    checkerId: string,
    dto: UpdatePropertyDto,
  ) {
    const db = this.databaseService.db;

    return db.transaction(async (tx) => {
      /*
       * 1. Verify that the assignment belongs
       *    to this checker.
       *
       * The checker can edit while the assignment is:
       *
       * CLAIMED
       * OR
       * IN_PROGRESS
       */
      const [assignment] = await tx
        .select()
        .from(assignments)
        .where(
          and(
            eq(assignments.id, assignmentId),
            eq(assignments.checkerId, checkerId),
            inArray(assignments.status, ['CLAIMED', 'IN_PROGRESS']),
          ),
        )
        .limit(1);

      if (!assignment) {
        throw new NotFoundException(
          'Assignment not found, not claimed by you, or not available for editing',
        );
      }

      /*
       * 2. Verify that the property belongs
       *    to this assignment.
       */
      const [assignmentProperty] = await tx
        .select({
          id: assignmentProperties.id,
          propertyId: assignmentProperties.propertyId,
        })
        .from(assignmentProperties)
        .where(
          and(
            eq(assignmentProperties.assignmentId, assignmentId),
            eq(assignmentProperties.propertyId, propertyId),
          ),
        )
        .limit(1);

      if (!assignmentProperty) {
        throw new NotFoundException(
          'Property does not belong to this assignment',
        );
      }

      /*
       * 3. Get the CURRENT property.
       *
       * This becomes oldValues.
       */
      const [existingProperty] = await tx
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!existingProperty) {
        throw new NotFoundException('Property not found');
      }

      const oldValues = {
        ...existingProperty,
      };

      /*
       * 4. Build the proposed property
       *    entirely in memory.
       */
      const newValues = {
        ...existingProperty,
      } as Record<string, unknown>;

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

      const changedFields: string[] = [];

      for (const field of allowedFields) {
        if (dto[field] !== undefined) {
          newValues[field] = dto[field];

          changedFields.push(field);
        }
      }

      if (changedFields.length === 0) {
        throw new BadRequestException('No property fields were provided');
      }

      /*
       * 5. Don't allow multiple PENDING
       *    reviews for the same property
       *    within this assignment.
       */
      const [existingPendingReview] = await tx
        .select({
          id: propertyReviews.id,
        })
        .from(propertyReviews)
        .where(
          and(
            eq(propertyReviews.assignmentPropertyId, assignmentProperty.id),
            eq(propertyReviews.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (existingPendingReview) {
        throw new ConflictException(
          'This property already has a pending review',
        );
      }

      /*
       * 6. Create the property review.
       *
       * The properties table remains unchanged.
       */
      const [review] = await tx
        .insert(propertyReviews)
        .values({
          assignmentPropertyId: assignmentProperty.id,
          checkerId,
          oldValues,
          newValues,
          checkerNotes: null,
          status: 'PENDING',
        })
        .returning();

      /*
       * DO NOT write to audit_logs here.
       *
       * This is only a proposal.
       *
       * The actual property change is recorded
       * when the reviewer approves it.
       */

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

  // ============================================================
  // SUBMIT
  // ============================================================

  /**
   * DATA_CHECKER submits their assignment.
   *
   * IN_PROGRESS -> SUBMITTED
   *
   * An assignment cannot be submitted while
   * any property still has a PENDING review.
   */
  async submit(assignmentId: string, checkerId: string) {
    const db = this.databaseService.db;

    return db.transaction(async (tx) => {
      /*
       * 1. Verify ownership and state.
       */
      const [assignment] = await tx
        .select()
        .from(assignments)
        .where(
          and(
            eq(assignments.id, assignmentId),
            eq(assignments.checkerId, checkerId),
          ),
        )
        .limit(1);

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

      /*
       * 2. Find assignment properties
       *    that still have PENDING reviews.
       */
      const pendingReviews = await tx
        .select({
          reviewId: propertyReviews.id,
        })
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

      if (pendingReviews.length > 0) {
        throw new ConflictException(
          `Assignment cannot be submitted because ${pendingReviews.length} property review(s) are still pending`,
        );
      }

      /*
       * 3. Submit assignment.
       */
      const [submittedAssignment] = await tx
        .update(assignments)
        .set({
          status: 'SUBMITTED',
          submittedAt: new Date(),
        })
        .where(
          and(
            eq(assignments.id, assignmentId),
            eq(assignments.checkerId, checkerId),
            eq(assignments.status, 'IN_PROGRESS'),
          ),
        )
        .returning();

      if (!submittedAssignment) {
        throw new ConflictException(
          'Assignment was already submitted or changed by another request',
        );
      }

      return submittedAssignment;
    });
  }

  // ============================================================
  // COMPLETE
  // ============================================================

  /**
   * ADMIN or REVIEWER completes a submitted assignment.
   *
   * SUBMITTED -> COMPLETED
   */
  async complete(assignmentId: string) {
    const db = this.databaseService.db;

    const [completedAssignment] = await db
      .update(assignments)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.status, 'SUBMITTED'),
        ),
      )
      .returning();

    if (!completedAssignment) {
      const [existingAssignment] = await db
        .select({
          id: assignments.id,
          status: assignments.status,
        })
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);

      if (!existingAssignment) {
        throw new NotFoundException('Assignment not found');
      }

      throw new ConflictException(
        `Assignment cannot be completed because it is ${existingAssignment.status}`,
      );
    }

    return completedAssignment;
  }
  // ============================================================
  // FIND ALL
  // ============================================================

  /**
   * Get paginated assignments.
   *
   * ADMIN, DATA_CHECKER and REVIEWER can view assignments.
   */
  async findAll(page = 1, limit = 20, status?: string) {
    const db = this.databaseService.db;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (status?.trim()) {
      conditions.push(eq(assignments.status, status.trim() as any));
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select()
      .from(assignments)
      .where(whereCondition)
      .orderBy(asc(assignments.createdAt))
      .limit(safeLimit)
      .offset(offset);

    const [totalResult] = await db
      .select({
        count: count(),
      })
      .from(assignments)
      .where(whereCondition);

    const total = Number(totalResult?.count ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);

    return {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1,
      },
    };
  }

  // ============================================================
  // FIND ONE
  // ============================================================

  /**
   * Get one assignment together with
   * its assigned properties.
   */
  async findOne(assignmentId: string, userId: string, userRole: string) {
    const db = this.databaseService.db;

    /*
     * 1. Find assignment.
     */
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    /*
     * 2. DATA_CHECKER can only view
     *    their own assignment.
     */
    if (userRole === 'DATA_CHECKER' && assignment.checkerId !== userId) {
      throw new ForbiddenException('You are not assigned to this assignment');
    }

    /*
     * 3. Get assigned properties.
     */
    const assignedProperties = await db
      .select({
        id: properties.id,
        address: properties.address,
        city: properties.city,
        state: properties.state,
        zip: properties.zip,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
        propertyType: properties.propertyType,
        yearBuilt: properties.yearBuilt,
        livingArea: properties.livingArea,
        lotSize: properties.lotSize,
        heating: properties.heating,
        cooling: properties.cooling,
        water: properties.water,
        sewer: properties.sewer,
        appliances: properties.appliances,
        features: properties.features,
        listingAgent: properties.listingAgent,
        buyerAgent: properties.buyerAgent,
        status: properties.status,
      })
      .from(assignmentProperties)
      .innerJoin(properties, eq(assignmentProperties.propertyId, properties.id))
      .where(eq(assignmentProperties.assignmentId, assignmentId));

    return {
      ...assignment,
      properties: assignedProperties,
    };
  }
}
