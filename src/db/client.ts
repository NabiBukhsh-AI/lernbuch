import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and fill in the Neon connection string.',
  );
}

/**
 * The Pool driver (rather than the HTTP driver) is required because quiz
 * submission has to be atomic across `attempts` and `attemptAnswers`, and only
 * the WebSocket pool supports transactions.
 *
 * Node 18+ ships a global WebSocket, so no `ws` polyfill is needed. The guard
 * keeps this working if it is ever bundled for a runtime that lacks one.
 */
if (typeof globalThis.WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

/*
 * Local development against docker-compose.yml: plain WebSocket to the
 * wsproxy container instead of TLS to Neon's edge.
 */
if (new URL(process.env.DATABASE_URL).hostname === 'localhost') {
  neonConfig.wsProxy = (host) => `${host}:5433/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

/**
 * Next.js dev server hot-reloads modules, which would otherwise open a new pool
 * on every reload until Neon refuses connections.
 */
const globalForDb = globalThis as unknown as { __dbPool?: Pool };

const pool =
  globalForDb.__dbPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__dbPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool, schema };
