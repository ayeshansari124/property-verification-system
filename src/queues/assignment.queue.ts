import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class AssignmentQueue implements OnModuleDestroy {
  private readonly queue: Queue;
  private readonly connection: IORedis;

  constructor(private readonly configService: ConfigService) {
    this.connection = new IORedis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('assignment-queue', {
      connection: this.connection,
    });
  }

  async addAssignmentStatsJob(assignmentId: string) {
    await this.queue.add(
      'calculate-assignment-stats',
      {
        assignmentId,
      },
      {
        jobId: `assignment-stats-${assignmentId}`,
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
