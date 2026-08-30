import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

import { reviewStatusEnum } from './enums.schema';
import { assignmentProperties } from './assignment-properties.schema';
import { users } from './users.schema';

export const propertyReviews = pgTable(
  'property_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    assignmentPropertyId: uuid('assignment_property_id')
      .notNull()
      .references(() => assignmentProperties.id),

    checkerId: uuid('checker_id')
      .notNull()
      .references(() => users.id),

    reviewerId: uuid('reviewer_id').references(() => users.id),

    oldValues: jsonb('old_values').notNull(),

    newValues: jsonb('new_values').notNull(),

    checkerNotes: text('checker_notes'),

    reviewerNotes: text('reviewer_notes'),

    status: reviewStatusEnum('status').default('PENDING').notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    reviewedAt: timestamp('reviewed_at', {
      withTimezone: true,
    }),
  },
  (table) => ({
    assignmentPropertyIdx: index('property_reviews_assignment_property_idx').on(
      table.assignmentPropertyId,
    ),

    statusIdx: index('property_reviews_status_idx').on(table.status),
  }),
);
