import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { properties } from '../database/schema';

@Injectable()
export class SearchWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;
  private connection: IORedis;

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
      'search-queue',
      async (job) => {
        if (job.name !== 'verify-property') {
          return;
        }

        const { propertyId } = job.data;

        console.log(`Starting property verification: ${propertyId}`);

        // Simulate external search / AI verification.
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const confidenceScore = Number((0.8 + Math.random() * 0.2).toFixed(2));

        await this.databaseService.db
          .update(properties)
          .set({
            status: confidenceScore >= 0.9 ? 'VERIFIED' : 'NEEDS_REVIEW',
            updatedAt: new Date(),
          })
          .where(eq(properties.id, propertyId));

        console.log(
          `Property ${propertyId} verified. Confidence: ${confidenceScore}`,
        );

        return {
          propertyId,
          confidenceScore,
        };
      },
      {
        connection: this.connection,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`Search job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`Search job ${job?.id} failed:`, error);
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
