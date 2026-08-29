import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { QueuesModule } from '../queues/queues.module';

import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [DatabaseModule, QueuesModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
