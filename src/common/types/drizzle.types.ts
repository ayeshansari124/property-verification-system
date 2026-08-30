import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type * as schema from '../../database/schema';

// The plain (non-transactional) database handle.
export type DrizzleDatabase = NodePgDatabase<typeof schema>;

// The handle passed into `db.transaction(async (tx) => ...)`.
export type DrizzleTransaction = PgTransaction<any, typeof schema, any>;

export type DbExecutor = DrizzleDatabase | DrizzleTransaction;
