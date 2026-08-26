import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import {
  assignmentProperties,
  assignments,
  properties,
} from '../database/schema';

import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly databaseService: DatabaseService) {}

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

    return result;
  }
}
