import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { QueuesModule } from '../queues/queues.module';

import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertiesRepository } from './properties.repository';

@Module({
  imports: [DatabaseModule, AuditModule, QueuesModule],
  controllers: [PropertiesController],
  providers: [PropertiesRepository, PropertiesService],
  exports: [PropertiesRepository, PropertiesService],
})
export class PropertiesModule {}
