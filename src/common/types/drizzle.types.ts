import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type * as schema from '../../database/schema';

/**
 * The plain (non-transactional) database handle.
 */
export type DrizzleDatabase = NodePgDatabase<typeof schema>;

/**
 * The handle passed into `db.transaction(async (tx) => ...)`.
 */
export type DrizzleTransaction = PgTransaction<any, typeof schema, any>;

/**
 * Repositories accept either a plain db handle or an
 * in-flight transaction, so services decide transaction
 * boundaries while repositories stay transaction-agnostic.
 */
export type DbExecutor = DrizzleDatabase | DrizzleTransaction;
