import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { users } from '@/db/schema';

/**
 * Clerk session → DB user row.
 *
 * The `users` table is normally kept in sync by the Clerk webhook, but we
 * upsert here as a safety net so auth-protected routes work even before the
 * webhook endpoint is configured (e.g. during development).
 */
export async function getOrCreateUser(clerkId: string) {
  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ clerkId })
    .onConflictDoNothing({ target: users.clerkId })
    .returning();
  return created ?? (await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) }));
}

export type AuthResult =
  | { ok: true; clerkId: string; user: NonNullable<Awaited<ReturnType<typeof getOrCreateUser>>> }
  | { ok: false; response: NextResponse };

/** Requires a signed-in Clerk session; resolves to the DB user (created if missing). */
export async function requireUser(): Promise<AuthResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, response: jsonError('Unauthenticated. Sign in first.', 401) };
  }
  const user = await getOrCreateUser(userId);
  return { ok: true, clerkId: userId, user };
}

/** Requires a signed-in user whose realtor application was approved. */
export async function requireApprovedRealtor(): Promise<AuthResult> {
  const base = await requireUser();
  if (!base.ok) return base;
  if (base.user.role !== 'realtor' || base.user.realtorStatus !== 'approved') {
    return {
      ok: false,
      response: jsonError('Realtor account required (approved by an admin).', 403),
    };
  }
  return base;
}

/** Requires a signed-in admin. */
export async function requireAdmin(): Promise<AuthResult> {
  const base = await requireUser();
  if (!base.ok) return base;
  if (base.user.role !== 'admin') {
    return { ok: false, response: jsonError('Admin access required.', 403) };
  }
  return base;
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Route-level catch: maps known infra problems to clean HTTP responses. */
export function handleRouteError(e: unknown): NextResponse {
  if (e instanceof Error && e.message.includes('DATABASE_URL')) {
    return jsonError('Database is not configured — check DATABASE_URL.', 503);
  }
  console.error('[api] unhandled error:', e);
  return jsonError('Internal server error.', 500);
}
