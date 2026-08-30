import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { QueuesModule } from '../queues/queues.module';
import { AuditModule } from '../audit/audit.module';
import { PropertiesModule } from '../properties/properties.module';

import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';

@Module({
  imports: [DatabaseModule, QueuesModule, AuditModule, PropertiesModule],
  controllers: [ReviewsController],
  providers: [ReviewsRepository, ReviewsService],
  exports: [ReviewsRepository, ReviewsService],
})
export class ReviewsModule {}
