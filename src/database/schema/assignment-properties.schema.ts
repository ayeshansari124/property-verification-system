import {
  pgTable,
  uuid,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { assignments } from './assignments.schema';
import { properties } from './properties.schema';

export const assignmentProperties = pgTable(
  'assignment_properties',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, {
        onDelete: 'cascade',
      }),

    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    assignmentPropertyUnique: uniqueIndex('assignment_property_unique').on(
      table.assignmentId,
      table.propertyId,
    ),

    assignmentIdx: index('assignment_properties_assignment_idx').on(
      table.assignmentId,
    ),

    propertyIdx: index('assignment_properties_property_idx').on(
      table.propertyId,
    ),
  }),
);
