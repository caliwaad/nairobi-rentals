import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { subscriptions } from '@/db/schema';
import { handleRouteError, jsonOk, requireApprovedRealtor } from '@/lib/auth';
import { intasendConfigured, subscriptionPrice } from '@/lib/intasend';
import { isActiveAt } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

/**
 * GET /api/subscription/status — the signed-in approved realtor's subscription.
 * Auto-expires the row when `current_period_end` has passed, and reports
 * `configured: false` when IntaSend keys are missing (the app shows a clear
 * "payments not configured" state instead of an error).
 */
export async function GET(_request: NextRequest) {
  try {
    const authed = await requireApprovedRealtor();
    if (!authed.ok) return authed.response;

    const db = getDb();
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.realtorId, authed.user.id),
    });

    if (!sub) {
      return jsonOk({
        configured: intasendConfigured(),
        price: subscriptionPrice(),
        subscription: null,
      });
    }

    const now = new Date();
    const active = isActiveAt(
      { status: sub.status, currentPeriodEnd: sub.currentPeriodEnd },
      now,
    );

    // Lazy expiry — persist it so the listing gate sees the truth on next POST.
    if (sub.status === 'active' && !active) {
      await db
        .update(subscriptions)
        .set({ status: 'expired' })
        .where(eq(subscriptions.id, sub.id));
      sub.status = 'expired';
    }

    return jsonOk({
      configured: intasendConfigured(),
      price: subscriptionPrice(),
      subscription: {
        status: sub.status,
        amount: sub.amount,
        currentPeriodEnd: sub.currentPeriodEnd,
        lastPaymentAt: sub.lastPaymentAt,
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
