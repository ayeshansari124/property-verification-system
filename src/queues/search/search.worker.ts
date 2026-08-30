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
import { properties } from '../../database/schema';

import { SEARCH_JOB_NAMES, SEARCH_QUEUE_NAME } from './search-queue.constants';

const VERIFICATION_DELAY_MS = 5000;
const CONFIDENCE_APPROVAL_THRESHOLD = 0.9;

@Injectable()
export class SearchWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchWorker.name);

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
      SEARCH_QUEUE_NAME,
      async (job) => {
        if (job.name !== SEARCH_JOB_NAMES.VERIFY_PROPERTY) {
          return;
        }

        return this.verifyProperty(job.data.propertyId);
      },
      { connection: this.connection },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Search job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Search job ${job?.id} failed`, error?.stack);
    });
  }

  private async verifyProperty(propertyId: string) {
    this.logger.log(`Starting property verification: ${propertyId}`);

    // Simulate an external AI/search verification call.
    // No real AI integration is required for this assignment.
    await new Promise((resolve) => setTimeout(resolve, VERIFICATION_DELAY_MS));

    const confidenceScore = Number((0.8 + Math.random() * 0.2).toFixed(2));

    await this.databaseService.db
      .update(properties)
      .set({
        status:
          confidenceScore >= CONFIDENCE_APPROVAL_THRESHOLD
            ? 'VERIFIED'
            : 'NEEDS_REVIEW',
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    this.logger.log(
      `Property ${propertyId} verified. Confidence: ${confidenceScore}`,
    );

    return { propertyId, confidenceScore };
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
  }
}
