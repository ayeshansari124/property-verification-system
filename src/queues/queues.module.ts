import { Module } from '@nestjs/common';

import { AssignmentQueue } from './assignment.queue';
import { AssignmentWorker } from './assignment.worker';
import { SearchQueue } from './search.queue';
import { SearchWorker } from './search.worker';

@Module({
  providers: [AssignmentQueue, AssignmentWorker, SearchQueue, SearchWorker],
  exports: [AssignmentQueue, SearchQueue],
})
export class QueuesModule {}
