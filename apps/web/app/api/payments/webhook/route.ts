import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { subscriptions } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk } from '@/lib/auth';
import { intasendConfigured, verifyWebhookEvent } from '@/lib/intasend';
import { applyPaymentEvent, webhookToEvent } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/webhook — IntaSend collection events (M-Pesa STK push).
 *
 * Security (PLAN §4-7, resolved): IntaSend embeds the `challenge` string set
 * on the dashboard in every payload — verification is challenge equality plus
 * an `api_ref` that matches a pending subscription row. Applies are idempotent
 * by `api_ref`/`invoice_id`, so retries and duplicates are safe.
 */
export async function POST(request: NextRequest) {
  try {
    if (!intasendConfigured()) {
      return jsonError('Payments are not configured.', 503);
    }
    const challenge = process.env.INTASEND_WEBHOOK_CHALLENGE;
    if (!challenge) {
      return jsonError('INTASEND_WEBHOOK_CHALLENGE is not set.', 503);
    }

    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return jsonError('Invalid JSON body.', 400);
    }

    const check = verifyWebhookEvent(body, challenge);
    if (!check.ok) return jsonError(check.reason, 400);

    const event = webhookToEvent(check.event);
    const db = getDb();
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.providerRef, event.apiRef),
    });

    // A valid challenge but an unknown ref — nothing to apply. Return 200 so
    // IntaSend doesn't retry (its webhook deactivates after 20 failures).
    if (!sub) return jsonOk({ ok: true, applied: false, reason: 'unknown_api_ref' });

    const next = applyPaymentEvent(
      {
        status: sub.status,
        providerRef: sub.providerRef,
        invoiceId: sub.invoiceId,
        currentPeriodEnd: sub.currentPeriodEnd,
        lastPaymentAt: sub.lastPaymentAt,
        history: (sub.history as unknown[]) ?? [],
      },
      event,
      new Date(),
    );

    if (!next) return jsonOk({ ok: true, applied: false, reason: 'duplicate' });

    await db
      .update(subscriptions)
      .set({
        status: next.status,
        providerRef: next.providerRef,
        invoiceId: next.invoiceId,
        currentPeriodEnd: next.currentPeriodEnd,
        lastPaymentAt: next.lastPaymentAt,
        history: next.history as never,
      })
      .where(eq(subscriptions.id, sub.id));

    return jsonOk({ ok: true, applied: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
