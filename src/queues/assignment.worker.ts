import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { assignments } from '../database/schema';

@Injectable()
export class AssignmentWorker implements OnModuleInit, OnModuleDestroy {
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
      'assignment-queue',
      async (job) => {
        console.log(`Processing assignment job: ${job.name}`, job.data);

        if (job.name === 'calculate-assignment-stats') {
          const assignmentId = job.data.assignmentId;

          console.log(`Calculating statistics for assignment ${assignmentId}`);

          const [assignment] = await this.databaseService.db
            .select({
              totalProperties: assignments.totalProperties,
            })
            .from(assignments)
            .where(eq(assignments.id, assignmentId))
            .limit(1);

          if (!assignment) {
            throw new Error(`Assignment ${assignmentId} not found`);
          }

          const estimatedCompletionMinutes = assignment.totalProperties * 5;

          await this.databaseService.db
            .update(assignments)
            .set({
              estimatedCompletionMinutes,
            })
            .where(eq(assignments.id, assignmentId));

          console.log(
            `Assignment ${assignmentId}: ` +
              `${assignment.totalProperties} properties, ` +
              `estimated completion: ` +
              `${estimatedCompletionMinutes} minutes`,
          );
        }
      },
      {
        connection: this.connection,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`Assignment job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`Assignment job ${job?.id} failed:`, error);
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }

    if (this.connection) {
      await this.connection.quit();
    }
  }
}
