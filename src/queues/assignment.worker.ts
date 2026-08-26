import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class AssignmentWorker implements OnModuleInit {
  private worker: Worker;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const connection = new IORedis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      'assignment-queue',
      async (job) => {
        console.log(`Processing assignment job: ${job.name}`, job.data);

        if (job.name === 'calculate-assignment-stats') {
          console.log(
            `Calculating statistics for assignment ${job.data.assignmentId}`,
          );
        }
      },
      {
        connection,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`Assignment job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`Assignment job ${job?.id} failed:`, error);
    });
  }
}
