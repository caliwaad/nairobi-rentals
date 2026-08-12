import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { listings } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/admin/listings/:id/approve — makes a listing live. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authed = await requireAdmin();
    if (!authed.ok) return authed.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return jsonError('Listing not found.', 404);

    const [updated] = await getDb()
      .update(listings)
      .set({ status: 'approved', rejectionReason: null })
      .where(eq(listings.id, id))
      .returning();

    if (!updated) return jsonError('Listing not found.', 404);
    return jsonOk({ listing: updated });
  } catch (e) {
    return handleRouteError(e);
  }
}
