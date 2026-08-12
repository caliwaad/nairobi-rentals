import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/realtor/apply — a signed-in user applies to become a realtor.
 *
 * Only the user can set their status to `pending`; approval/rejection is an
 * admin-only action (see the admin route). Idempotent: a second apply while
 * already pending just returns the current state.
 */
export async function POST(_request: NextRequest) {
  try {
    const authed = await requireUser();
    if (!authed.ok) return authed.response;

    const { user } = authed;
    if (user.realtorStatus === 'approved') {
      return jsonError('You are already an approved realtor.', 409);
    }
    if (user.realtorStatus === 'rejected') {
      return jsonError(
        'Your previous application was not approved — contact support to reapply.',
        409,
      );
    }
    if (user.realtorStatus === 'pending') {
      return jsonOk({ user, alreadyApplied: true });
    }

    const [updated] = await getDb()
      .update(users)
      .set({ realtorStatus: 'pending' })
      .where(eq(users.id, user.id))
      .returning();

    return jsonOk({ user: updated, alreadyApplied: false }, 201);
  } catch (e) {
    return handleRouteError(e);
  }
}
