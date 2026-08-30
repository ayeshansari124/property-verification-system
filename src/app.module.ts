import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { QueuesModule } from './queues/queues.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PropertiesModule } from './properties/properties.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    DatabaseModule,

    AuthModule,

    QueuesModule,
    PropertiesModule,
    AuditModule,
    AssignmentsModule,
    ReviewsModule,
  ],
})
export class AppModule {}
