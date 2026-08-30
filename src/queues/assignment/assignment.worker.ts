import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { eq } from 'drizzle-orm';

import { DatabaseService } from '../../database/database.service';
import { assignments } from '../../database/schema';

import {
  ASSIGNMENT_JOB_NAMES,
  ASSIGNMENT_QUEUE_NAME,
} from './assignment-queue.constants';

/**
 * Rough heuristic used to turn a property count into an
 * estimated completion time for the assignment stats job.
 * No real AI/ML estimation is required per the assignment spec.
 */
const ESTIMATED_MINUTES_PER_PROPERTY = 5;

@Injectable()
export class AssignmentWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssignmentWorker.name);

  private worker?: Worker;
  private connection?: IORedis;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  onModuleInit() {
    this.connection = new IORedis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      ASSIGNMENT_QUEUE_NAME,
      async (job) => {
        if (job.name === ASSIGNMENT_JOB_NAMES.CALCULATE_STATS) {
          await this.calculateAssignmentStats(job.data.assignmentId);
        }
      },
      { connection: this.connection },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Assignment job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Assignment job ${job?.id} failed`, error?.stack);
    });
  }

  private async calculateAssignmentStats(assignmentId: string) {
    const [assignment] = await this.databaseService.db
      .select({ totalProperties: assignments.totalProperties })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      throw new Error(`Assignment ${assignmentId} not found`);
    }

    const estimatedCompletionMinutes =
      assignment.totalProperties * ESTIMATED_MINUTES_PER_PROPERTY;

    await this.databaseService.db
      .update(assignments)
      .set({ estimatedCompletionMinutes })
      .where(eq(assignments.id, assignmentId));

    this.logger.log(
      `Assignment ${assignmentId}: ${assignment.totalProperties} properties, ` +
        `estimated completion: ${estimatedCompletionMinutes} minutes`,
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
  }
}
