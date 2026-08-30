import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

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
