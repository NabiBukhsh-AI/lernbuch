import { getTableName, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * `"table"."column"`, always.
 *
 * In a single-table `select`, Drizzle renders columns inside `sql` fields
 * without their table name. A correlated subquery written as
 * `where ${vocabItems.lessonId} = ${lessons.id}` then becomes
 * `where "lesson_id" = "id"`, and `"id"` silently binds to the inner table.
 * Every column in a correlated subquery goes through this instead.
 */
export function qualified(column: AnyPgColumn) {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}
