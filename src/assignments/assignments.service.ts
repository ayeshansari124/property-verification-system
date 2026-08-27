import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import { AssignmentQueue } from '../queues/assignment.queue';
import { DatabaseService } from '../database/database.service';
import { UpdatePropertyDto } from './dto/update-property.dto';

import {
  assignmentProperties,
  assignments,
  properties,
} from '../database/schema';

import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly assignmentQueue: AssignmentQueue,
    private readonly databaseService: DatabaseService,
  ) {}

  async create(dto: CreateAssignmentDto, adminId: string) {
    const db = this.databaseService.db;

    const result = await db.transaction(async (tx) => {
      const selectedProperties = await tx
        .select({
          id: properties.id,
        })
        .from(properties)
        .where(inArray(properties.id, dto.propertyIds));

      if (selectedProperties.length !== dto.propertyIds.length) {
        throw new BadRequestException('One or more property IDs do not exist');
      }

      const [assignment] = await tx
        .insert(assignments)
        .values({
          name: dto.name,
          totalProperties: dto.propertyIds.length,
          status: 'OPEN',
          createdBy: adminId,
        })
        .returning();

      await tx.insert(assignmentProperties).values(
        dto.propertyIds.map((propertyId) => ({
          assignmentId: assignment.id,
          propertyId,
        })),
      );

      return assignment;
    });

    await this.assignmentQueue.addAssignmentStatsJob(result.id);

    return result;
  }

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

      throw new ConflictException('Assignment has already been claimed');
    }

    return claimedAssignment;
  }

  async updateProperty(
    assignmentId: string,
    propertyId: string,
    checkerId: string,
    dto: UpdatePropertyDto,
  ) {
    const db = this.databaseService.db;

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.checkerId, checkerId),
          eq(assignments.status, 'CLAIMED'),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw new NotFoundException(
        'Assignment not found, not claimed by you, or not in CLAIMED status',
      );
    }

    const [assignmentProperty] = await db
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

    const [existingProperty] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!existingProperty) {
      throw new NotFoundException('Property not found');
    }

    const oldValues = { ...existingProperty };

    const updateData: Record<string, unknown> = {};

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

    for (const field of allowedFields) {
      if (dto[field] !== undefined) {
        updateData[field] = dto[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No property fields were provided');
    }

    const [updatedProperty] = await db
      .update(properties)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId))
      .returning();

    return {
      assignmentId,
      property: updatedProperty,
      oldValues,
      newValues: updatedProperty,
    };
  }
  async findOne(assignmentId: string, userId: string, userRole: string) {
    const db = this.databaseService.db;

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Data Checkers can only view assignments assigned to them.
    if (userRole === 'DATA_CHECKER' && assignment.checkerId !== userId) {
      throw new ForbiddenException('You are not assigned to this assignment');
    }

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
