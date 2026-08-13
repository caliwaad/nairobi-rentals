import { describe, expect, it } from 'vitest';

import { SUBSCRIPTION_DAYS } from '@/lib/intasend';
import {
  applyPaymentEvent,
  isActiveAt,
  nextPeriodEnd,
  webhookToEvent,
  type SubscriptionState,
} from '@/lib/subscription';

const NOW = new Date('2026-08-13T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function fresh(): SubscriptionState {
  return {
    status: 'pending',
    providerRef: 'NR-abc-1',
    invoiceId: null,
    currentPeriodEnd: null,
    lastPaymentAt: null,
    history: [],
  };
}

describe('nextPeriodEnd', () => {
  it('starts a new period from now', () => {
    expect(nextPeriodEnd(null, NOW).getTime()).toBe(NOW.getTime() + SUBSCRIPTION_DAYS * DAY);
  });

  it('extends an existing future period (renewal before expiry)', () => {
    const end = new Date(NOW.getTime() + 10 * DAY);
    expect(nextPeriodEnd(end, NOW).getTime()).toBe(end.getTime() + SUBSCRIPTION_DAYS * DAY);
  });

  it('restarts from now when the period already lapsed', () => {
    const past = new Date(NOW.getTime() - 5 * DAY);
    expect(nextPeriodEnd(past, NOW).getTime()).toBe(NOW.getTime() + SUBSCRIPTION_DAYS * DAY);
  });
});

describe('applyPaymentEvent', () => {
  it('activates on COMPLETE with a 30-day period and a history entry', () => {
    const next = applyPaymentEvent(fresh(), webhookToEvent({
      api_ref: 'NR-abc-1',
      invoice_id: 'INV-1',
      state: 'COMPLETE',
      value: '1547',
    }), NOW);

    expect(next).not.toBeNull();
    expect(next?.status).toBe('active');
    expect(next?.invoiceId).toBe('INV-1');
    expect(next?.currentPeriodEnd?.getTime()).toBe(NOW.getTime() + SUBSCRIPTION_DAYS * DAY);
    expect(next?.lastPaymentAt?.getTime()).toBe(NOW.getTime());
    expect(next?.history).toHaveLength(1);
  });

  it('is idempotent: the same invoice completing twice is a no-op', () => {
    const once = applyPaymentEvent(fresh(), webhookToEvent({
      api_ref: 'NR-abc-1',
      invoice_id: 'INV-1',
      state: 'COMPLETE',
    }), NOW)!;
    const twice = applyPaymentEvent(once, webhookToEvent({
      api_ref: 'NR-abc-1',
      invoice_id: 'INV-1',
      state: 'COMPLETE',
    }), NOW);
    expect(twice).toBeNull();
  });

  it('renews: a COMPLETE with a new invoice extends the active period', () => {
    const active = {
      ...fresh(),
      status: 'active' as const,
      invoiceId: 'INV-1',
      currentPeriodEnd: new Date(NOW.getTime() + 10 * DAY),
    };
    const renewed = applyPaymentEvent(active, webhookToEvent({
      api_ref: 'NR-abc-2',
      invoice_id: 'INV-2',
      state: 'COMPLETE',
    }), NOW);

    expect(renewed).not.toBeNull();
    expect(renewed?.invoiceId).toBe('INV-2');
    expect(renewed?.currentPeriodEnd?.getTime()).toBe(active.currentPeriodEnd!.getTime() + SUBSCRIPTION_DAYS * DAY);
  });

  it('marks a pending payment failed on FAILED', () => {
    const next = applyPaymentEvent(fresh(), webhookToEvent({
      api_ref: 'NR-abc-1',
      state: 'FAILED',
      failed_reason: 'PIN timeout',
    }), NOW);
    expect(next?.status).toBe('failed');
  });

  it('never locks out an active realtor because a renewal FAILED', () => {
    const active = {
      ...fresh(),
      status: 'active' as const,
      currentPeriodEnd: new Date(NOW.getTime() + 10 * DAY),
    };
    const next = applyPaymentEvent(active, webhookToEvent({
      api_ref: 'NR-abc-2',
      state: 'FAILED',
    }), NOW);
    expect(next?.status).toBe('active');
    expect(next?.history).toHaveLength(1);
  });

  it('tracks PROCESSING without touching an active subscription', () => {
    const active = {
      ...fresh(),
      status: 'active' as const,
      currentPeriodEnd: new Date(NOW.getTime() + 10 * DAY),
    };
    expect(applyPaymentEvent(active, webhookToEvent({
      api_ref: 'NR-abc-2',
      state: 'PROCESSING',
    }), NOW)).toBeNull();
  });
});

describe('isActiveAt', () => {
  it('is true only for active subscriptions with a future period end', () => {
    expect(isActiveAt({ status: 'active', currentPeriodEnd: new Date(NOW.getTime() + DAY) }, NOW)).toBe(true);
    expect(isActiveAt({ status: 'active', currentPeriodEnd: new Date(NOW.getTime() - DAY) }, NOW)).toBe(false);
    expect(isActiveAt({ status: 'pending', currentPeriodEnd: new Date(NOW.getTime() + DAY) }, NOW)).toBe(false);
    expect(isActiveAt({ status: null, currentPeriodEnd: null }, NOW)).toBe(false);
  });
});
