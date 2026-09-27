/**
 * Loads .env.local before anything else does.
 *
 * This exists as its own module because ES module imports are hoisted: every
 * `import` in a script is evaluated before the first line of that script's body
 * runs. Calling dotenv's `config()` in the body of a script is therefore too
 * late — `src/db/client.ts` has already read `process.env.DATABASE_URL` and
 * thrown by then.
 *
 * Import this first, before any module that touches the environment:
 *
 *   import './_env';
 *   import { db } from '../src/db/client';
 */
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'] });
