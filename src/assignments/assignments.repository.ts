import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, inArray, SQL } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import {
  assignmentProperties,
  assignments,
  properties,
} from '../database/schema';
import { DbExecutor } from '../common/types/drizzle.types';

type AssignmentStatus =
  'OPEN' | 'CLAIMED' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED';

@Injectable()
export class AssignmentsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.db;
  }

  async findExistingPropertyIds(executor: DbExecutor, propertyIds: string[]) {
    const rows = await executor
      .select({ id: properties.id })
      .from(properties)
      .where(inArray(properties.id, propertyIds));

    return rows.map((row) => row.id);
  }

  async insertAssignment(
    executor: DbExecutor,
    data: { name: string; totalProperties: number; createdBy: string },
  ) {
    const [assignment] = await executor
      .insert(assignments)
      .values({
        name: data.name,
        totalProperties: data.totalProperties,
        status: 'OPEN',
        createdBy: data.createdBy,
      })
      .returning();

    return assignment;
  }

  async insertAssignmentProperties(
    executor: DbExecutor,
    assignmentId: string,
    propertyIds: string[],
  ) {
    await executor.insert(assignmentProperties).values(
      propertyIds.map((propertyId) => ({
        assignmentId,
        propertyId,
      })),
    );
  }

  /**
   * Atomically claims an OPEN assignment for a checker.
   *
   * The WHERE clause including `status = 'OPEN'` is what makes
   * this safe under concurrency: only one of two simultaneous
   * claim requests can match a row and return it, because
   * Postgres serializes concurrent UPDATEs on the same row.
   */
  async claimOpenAssignment(assignmentId: string, checkerId: string) {
    const [claimed] = await this.db
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

    return claimed;
  }

  /**
   * Atomically transitions a checker's own CLAIMED assignment to IN_PROGRESS.
   */
  async startClaimedAssignment(assignmentId: string, checkerId: string) {
    const [started] = await this.db
      .update(assignments)
      .set({ status: 'IN_PROGRESS' })
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.checkerId, checkerId),
          eq(assignments.status, 'CLAIMED'),
        ),
      )
      .returning();

    return started;
  }

  /**
   * Atomically transitions a checker's own IN_PROGRESS assignment to SUBMITTED.
   *
   * Takes an explicit executor (rather than defaulting to the pool `db`)
   * because this is always called from inside `AssignmentsService.submit()`'s
   * transaction: the pending-reviews count check and this status update
   * must commit together, or a review could sneak in between the check
   * and the update under concurrent requests.
   */
  async submitInProgressAssignment(
    executor: DbExecutor,
    assignmentId: string,
    checkerId: string,
  ) {
    const [submitted] = await executor
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

    return submitted;
  }

  /**
   * Atomically transitions a SUBMITTED assignment to COMPLETED.
   */
  async completeSubmittedAssignment(assignmentId: string) {
    const [completed] = await this.db
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

    return completed;
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    const [assignment] = await executor
      .select()
      .from(assignments)
      .where(eq(assignments.id, id))
      .limit(1);

    return assignment;
  }

  async findOwnedInStatuses(
    executor: DbExecutor,
    id: string,
    checkerId: string,
    statuses: AssignmentStatus[],
  ) {
    const [assignment] = await executor
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.id, id),
          eq(assignments.checkerId, checkerId),
          inArray(assignments.status, statuses),
        ),
      )
      .limit(1);

    return assignment;
  }

  async findOwnedByChecker(
    executor: DbExecutor,
    id: string,
    checkerId: string,
  ) {
    const [assignment] = await executor
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, id), eq(assignments.checkerId, checkerId)))
      .limit(1);

    return assignment;
  }

  async findAssignmentProperty(
    executor: DbExecutor,
    assignmentId: string,
    propertyId: string,
  ) {
    const [assignmentProperty] = await executor
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

    return assignmentProperty;
  }

  async findAssignedProperties(assignmentId: string) {
    return this.db
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
  }

  async findMany(limit: number, offset: number, status?: string) {
    const whereCondition = this.buildStatusFilter(status);

    return this.db
      .select()
      .from(assignments)
      .where(whereCondition)
      .orderBy(asc(assignments.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async count(status?: string) {
    const whereCondition = this.buildStatusFilter(status);

    const [result] = await this.db
      .select({ count: count() })
      .from(assignments)
      .where(whereCondition);

    return Number(result?.count ?? 0);
  }

  private buildStatusFilter(status?: string): SQL | undefined {
    if (!status?.trim()) {
      return undefined;
    }

    return eq(assignments.status, status.trim() as AssignmentStatus);
  }
}
