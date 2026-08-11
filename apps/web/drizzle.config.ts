import dotenv from 'dotenv';
import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit only auto-loads `.env`; the documented dev env file is `.env.local`.
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  // No schema prefix — Neon projects use the default `public` schema.
  strict: true,
  verbose: true,
});
