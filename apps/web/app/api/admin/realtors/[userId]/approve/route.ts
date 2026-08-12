import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/admin/realtors/:userId/approve — grants realtor access. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const authed = await requireAdmin();
    if (!authed.ok) return authed.response;

    const { userId } = await params;
    if (!UUID_RE.test(userId)) return jsonError('User not found.', 404);

    const [updated] = await getDb()
      .update(users)
      .set({ role: 'realtor', realtorStatus: 'approved', rejectionReason: null })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) return jsonError('User not found.', 404);
    return jsonOk({ user: updated });
  } catch (e) {
    return handleRouteError(e);
  }
}
