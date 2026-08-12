import { and, asc, eq, getTableColumns } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/realtors — admin-only list of realtor applications awaiting
 * review (pending), oldest first.
 */
export async function GET(_request: NextRequest) {
  try {
    const authed = await requireAdmin();
    if (!authed.ok) return authed.response;

    const applications = await getDb()
      .select({ ...getTableColumns(users) })
      .from(users)
      .where(and(eq(users.realtorStatus, 'pending'), eq(users.role, 'user')))
      .orderBy(asc(users.createdAt));

    return jsonOk({ applications });
  } catch (e) {
    return handleRouteError(e);
  }
}
