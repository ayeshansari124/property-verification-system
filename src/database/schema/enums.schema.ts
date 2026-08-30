import { pgEnum } from 'drizzle-orm/pg-core';

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
