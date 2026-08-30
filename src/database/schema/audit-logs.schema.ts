import { pgTable, uuid, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

import { properties } from './properties.schema';
import { users } from './users.schema';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    changedFields: jsonb('changed_fields').notNull(),

    oldValues: jsonb('old_values').notNull(),

    newValues: jsonb('new_values').notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    propertyIdx: index('audit_logs_property_idx').on(table.propertyId),

    userIdx: index('audit_logs_user_idx').on(table.userId),

    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  }),
);
