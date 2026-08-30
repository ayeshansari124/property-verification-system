import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { SEARCH_JOB_NAMES, SEARCH_QUEUE_NAME } from './search-queue.constants';

@Injectable()
export class SearchQueue implements OnModuleDestroy {
  private readonly queue: Queue;
  private readonly connection: IORedis;

  constructor(private readonly configService: ConfigService) {
    this.connection = new IORedis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue(SEARCH_QUEUE_NAME, {
      connection: this.connection,
    });
  }

  async addPropertyVerificationJob(propertyId: string) {
    await this.queue.add(
      SEARCH_JOB_NAMES.VERIFY_PROPERTY,
      { propertyId },
      {
        jobId: `property-verification-${propertyId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }
}
