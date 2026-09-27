import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Next.js reads .env.local; drizzle-kit does not know about it on its own.
config({ path: ['.env.local', '.env'] });

/*
 * `generate` only reads src/db/schema.ts and never opens a connection, so it
 * must keep working before a database exists. Everything else does connect and
 * fails here with a readable message rather than a driver-level error.
 */
const NEEDS_CONNECTION = ['migrate', 'push', 'pull', 'studio', 'check', 'up'];
const requiresConnection = process.argv.some((arg) => NEEDS_CONNECTION.includes(arg));

const url = process.env.DATABASE_URL;

if (!url && requiresConnection) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and fill in the Neon connection string.',
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: url ?? '' },
  strict: true,
  verbose: true,
});
