import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { listings } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/listings/:id/reject — declines a listing.
 * Optional `{ reason }` body is stored and shown to the realtor.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authed = await requireAdmin();
    if (!authed.ok) return authed.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return jsonError('Listing not found.', 404);

    const body = await request.json().catch(() => null);
    const reason =
      body && typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

    const [updated] = await getDb()
      .update(listings)
      .set({ status: 'rejected', rejectionReason: reason })
      .where(eq(listings.id, id))
      .returning();

    if (!updated) return jsonError('Listing not found.', 404);
    return jsonOk({ listing: updated });
  } catch (e) {
    return handleRouteError(e);
  }
}
