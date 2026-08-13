import type { SubscriptionStatus } from '@/db/schema';
import { SUBSCRIPTION_DAYS, type IntaSendWebhookEvent } from '@/lib/intasend';

/**
 * Pure subscription state machine (PLAN §9 — "All idempotent by key").
 * `applyPaymentEvent` is the single place a webhook event turns into state
 * changes, so it is unit-testable without a database.
 */

export interface SubscriptionState {
  status: SubscriptionStatus;
  providerRef: string | null;
  invoiceId: string | null;
  currentPeriodEnd: Date | null;
  lastPaymentAt: Date | null;
  history: unknown[];
}

export interface PaymentEvent {
  state: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
  apiRef: string;
  invoiceId?: string | null;
  failedReason?: string | null;
  createdAt?: string;
  amount?: string | number | null;
}

/** Map an IntaSend webhook payload to the minimal event shape we act on. */
export function webhookToEvent(raw: IntaSendWebhookEvent): PaymentEvent {
  return {
    state: raw.state as PaymentEvent['state'],
    apiRef: raw.api_ref as string,
    invoiceId: raw.invoice_id ?? null,
    failedReason: raw.failed_reason ?? null,
    createdAt: raw.created_at,
    amount: raw.amount ?? raw.value ?? raw.net_amount ?? null,
  };
}

/** End of the next subscription period: extends an existing future period. */
export function nextPeriodEnd(currentEnd: Date | null, now: Date): Date {
  const base = currentEnd && currentEnd > now ? currentEnd : now;
  return new Date(base.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Apply a webhook event to a subscription snapshot.
 * Returns the next state (with appended history), or `null` when the event is
 * a no-op (e.g. a duplicate COMPLETE for the same invoice).
 */
export function applyPaymentEvent(
  current: SubscriptionState,
  event: PaymentEvent,
  now: Date,
): SubscriptionState | null {
  const historyEntry = {
    at: now.toISOString(),
    state: event.state,
    apiRef: event.apiRef,
    invoiceId: event.invoiceId ?? null,
    amount: event.amount ?? null,
    failedReason: event.failedReason ?? null,
  };

  switch (event.state) {
    case 'COMPLETE': {
      // Idempotency: the same invoice completing twice must not extend twice.
      if (
        current.status === 'active' &&
        current.invoiceId &&
        event.invoiceId &&
        current.invoiceId === event.invoiceId
      ) {
        return null;
      }
      return {
        status: 'active',
        providerRef: event.apiRef,
        invoiceId: event.invoiceId ?? current.invoiceId,
        currentPeriodEnd: nextPeriodEnd(current.currentPeriodEnd, now),
        lastPaymentAt: now,
        history: [...current.history, historyEntry],
      };
    }
    case 'FAILED': {
      // A failed renewal must not lock out a realtor who already paid —
      // keep the active period, but record the failure for reminders.
      if (current.status === 'active') {
        return { ...current, history: [...current.history, historyEntry] };
      }
      return {
        ...current,
        status: 'failed',
        history: [...current.history, historyEntry],
      };
    }
    case 'PENDING':
    case 'PROCESSING': {
      if (current.status === 'active') return null;
      return {
        ...current,
        status: 'pending',
        providerRef: event.apiRef,
        invoiceId: event.invoiceId ?? current.invoiceId,
        history: [...current.history, historyEntry],
      };
    }
  }
}

/** Is this snapshot an active subscription right now? (auto-expiry helper) */
export function isActiveAt(
  sub: Pick<SubscriptionState, 'currentPeriodEnd'> & { status: SubscriptionStatus | null },
  now: Date,
): boolean {
  return (
    sub.status === 'active' &&
    sub.currentPeriodEnd !== null &&
    new Date(sub.currentPeriodEnd) > now
  );
}
