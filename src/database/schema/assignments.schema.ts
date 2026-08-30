import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

import { assignmentStatusEnum } from './enums.schema';
import { users } from './users.schema';

export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 200 }).notNull(),

    status: assignmentStatusEnum('status').default('OPEN').notNull(),

    checkerId: uuid('checker_id').references(() => users.id),

    totalProperties: integer('total_properties').default(0).notNull(),

    estimatedCompletionMinutes: integer('estimated_completion_minutes'),

    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    claimedAt: timestamp('claimed_at', {
      withTimezone: true,
    }),

    submittedAt: timestamp('submitted_at', {
      withTimezone: true,
    }),

    completedAt: timestamp('completed_at', {
      withTimezone: true,
    }),
  },
  (table) => ({
    checkerIdx: index('assignments_checker_idx').on(table.checkerId),

    statusIdx: index('assignments_status_idx').on(table.status),
  }),
);
