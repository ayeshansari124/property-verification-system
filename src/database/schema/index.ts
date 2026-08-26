import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ENUMS

export const userRoleEnum = pgEnum('user_role', [
  'ADMIN',
  'DATA_CHECKER',
  'REVIEWER',
]);

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'OPEN',
  'CLAIMED',
  'IN_PROGRESS',
  'SUBMITTED',
  'COMPLETED',
]);

export const reviewStatusEnum = pgEnum('review_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'RETURNED',
]);

// USERS

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

// PROPERTIES

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    address: varchar('address', { length: 255 }).notNull(),

    city: varchar('city', { length: 100 }).notNull(),

    state: varchar('state', { length: 100 }).notNull(),

    zip: varchar('zip', { length: 20 }).notNull(),

    bedrooms: integer('bedrooms'),

    bathrooms: integer('bathrooms'),

    propertyType: varchar('property_type', {
      length: 100,
    }),

    yearBuilt: integer('year_built'),

    livingArea: integer('living_area'),

    lotSize: integer('lot_size'),

    heating: varchar('heating', { length: 100 }),

    cooling: varchar('cooling', { length: 100 }),

    water: varchar('water', { length: 100 }),

    sewer: varchar('sewer', { length: 100 }),

    appliances: jsonb('appliances'),

    features: jsonb('features'),

    listingAgent: varchar('listing_agent', {
      length: 200,
    }),

    buyerAgent: varchar('buyer_agent', {
      length: 200,
    }),

    status: varchar('status', { length: 50 }),

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
    cityStateIdx: index('properties_city_state_idx').on(
      table.city,
      table.state,
    ),

    zipIdx: index('properties_zip_idx').on(table.zip),
  }),
);

// ASSIGNMENTS

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

// ASSIGNMENT PROPERTIES

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

// PROPERTY REVIEWS

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

// AUDIT LOGS

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
