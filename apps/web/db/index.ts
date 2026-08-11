import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';

import * as schema from './schema';

type Db = NeonHttpDatabase<typeof schema>;

let cached: Db | null = null;

/**
 * Lazy singleton so route modules can import this file safely even before
 * DATABASE_URL is configured (e.g. during `next build`). A route that touches
 * the DB without a connection string gets a clear 503-style error instead of
 * a cryptic build/runtime failure.
 */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add it to apps/web/.env.local (see .env.example).',
    );
  }
  const sql = neon(url) as NeonQueryFunction<false, false>;
  cached = drizzle(sql, { schema });
  return cached;
}
