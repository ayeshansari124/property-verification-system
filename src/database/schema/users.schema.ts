import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { userRoleEnum } from './enums.schema';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 150 }).notNull(),

    email: varchar('email', { length: 255 }).notNull(),

    passwordHash: text('password_hash').notNull(),

    role: userRoleEnum('role').notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex('users_email_unique').on(table.email),
  }),
);
