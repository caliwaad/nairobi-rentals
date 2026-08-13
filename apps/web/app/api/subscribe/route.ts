import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { subscriptions } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk, requireApprovedRealtor } from '@/lib/auth';
import {
  chargeAmountFor,
  initiateStkPush,
  intasendConfigured,
  normalizeKenyanPhone,
  subscriptionPrice,
} from '@/lib/intasend';

export const dynamic = 'force-dynamic';

/**
 * POST /api/subscribe — an approved realtor starts (or renews) their monthly
 * subscription. Triggers an M-Pesa STK push to the phone on their profile.
 *
 * Idempotent: while a subscription is already active, this returns the current
 * state without pushing again. Each new push gets a fresh `api_ref` recorded
 * on the subscriptions row, which the webhook matches for idempotent applies.
 */
export async function POST(_request: NextRequest) {
  try {
    const authed = await requireApprovedRealtor();
    if (!authed.ok) return authed.response;

    if (!intasendConfigured()) {
      return jsonError('Payments are not configured yet — try again later.', 503);
    }

    const phone = normalizeKenyanPhone(authed.user.phone ?? '');
    if (!phone) {
      return jsonError(
        'Add your M-Pesa phone number (07XX…) on the Profile tab before subscribing.',
        400,
      );
    }

    const db = getDb();
    const existing = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.realtorId, authed.user.id),
    });

    const now = new Date();
    if (
      existing?.status === 'active' &&
      existing.currentPeriodEnd &&
      new Date(existing.currentPeriodEnd) > now
    ) {
      return jsonOk({ alreadyActive: true, subscription: existing });
    }

    const amount = chargeAmountFor(subscriptionPrice());
    const apiRef = `NR-${authed.user.id.slice(0, 8)}-${Date.now()}`;

    // Record the attempt *before* calling out so the webhook has a row to match.
    const [row] = existing
      ? await db
          .update(subscriptions)
          .set({ providerRef: apiRef, invoiceId: null, status: 'pending', amount })
          .where(eq(subscriptions.id, existing.id))
          .returning()
      : await db
          .insert(subscriptions)
          .values({ realtorId: authed.user.id, providerRef: apiRef, amount })
          .returning();

    try {
      const pushed = await initiateStkPush({
        amount,
        phoneNumber: phone,
        apiRef,
        name: authed.user.name ?? authed.user.username ?? 'Nairobi Rentals Realtor',
        email: authed.user.email ?? '',
        narrative: 'Nairobi Rentals monthly subscription',
      });
      if (pushed.invoiceId) {
        await db
          .update(subscriptions)
          .set({ invoiceId: pushed.invoiceId })
          .where(eq(subscriptions.id, row.id));
      }
      return jsonOk(
        {
          subscription: { ...row, invoiceId: pushed.invoiceId ?? row.invoiceId },
          pushed,
        },
        201,
      );
    } catch (e) {
      await db
        .update(subscriptions)
        .set({ status: 'failed' })
        .where(eq(subscriptions.id, row.id));
      const message = e instanceof Error ? e.message : 'The payment request failed.';
      return jsonError(`M-Pesa request failed: ${message}`, 502);
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
