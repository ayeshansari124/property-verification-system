import { Module } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, QueuesModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
