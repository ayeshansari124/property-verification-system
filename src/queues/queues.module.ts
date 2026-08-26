import { Module } from '@nestjs/common';

import { AssignmentQueue } from './assignment.queue';
import { AssignmentWorker } from './assignment.worker';

@Module({
  providers: [AssignmentQueue, AssignmentWorker],

  exports: [AssignmentQueue],
})
export class QueuesModule {}
