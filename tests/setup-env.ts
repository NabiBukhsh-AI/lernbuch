/**
 * Loads .env.local for tests that talk to the database.
 *
 * Referenced from vitest.config.ts as a setup file, which runs before any test
 * module is imported — early enough for src/db/client.ts to see DATABASE_URL.
 */
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'] });
