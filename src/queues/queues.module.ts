import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { AssignmentQueue } from './assignment/assignment.queue';
import { AssignmentWorker } from './assignment/assignment.worker';
import { SearchQueue } from './search/search.queue';
import { SearchWorker } from './search/search.worker';

@Module({
  imports: [DatabaseModule],
  providers: [AssignmentQueue, AssignmentWorker, SearchQueue, SearchWorker],
  exports: [AssignmentQueue, SearchQueue],
})
export class QueuesModule {}
