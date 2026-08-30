import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { QueuesModule } from '../queues/queues.module';
import { PropertiesModule } from '../properties/properties.module';
import { ReviewsModule } from '../reviews/reviews.module';

import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { AssignmentsRepository } from './assignments.repository';

@Module({
  imports: [DatabaseModule, QueuesModule, PropertiesModule, ReviewsModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsRepository, AssignmentsService],
  exports: [AssignmentsRepository, AssignmentsService],
})
export class AssignmentsModule {}
