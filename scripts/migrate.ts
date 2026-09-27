/**
 * Applies pending migrations from ./drizzle.
 *
 * Goes through the app's own client rather than drizzle-kit, so it works
 * against Neon and against the local docker-compose proxy alike. Uses the same
 * `drizzle.__drizzle_migrations` bookkeeping table as `drizzle-kit migrate`.
 *
 *   pnpm db:migrate
 */
// Must stay first: loads .env.local before db/client.ts reads DATABASE_URL.
import './_env';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { db, pool } from '../src/db/client';

migrate(db, { migrationsFolder: './drizzle' })
  .then(() => console.log('Migrations applied.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
