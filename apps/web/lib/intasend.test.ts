import { describe, expect, it, vi } from 'vitest';

import {
  chargeAmountFor,
  intasendConfigured,
  normalizeKenyanPhone,
  verifyWebhookEvent,
} from '@/lib/intasend';

const VALID_EVENT = {
  invoice_id: 'BRZKGPR',
  state: 'COMPLETE',
  value: '1547.00',
  currency: 'KES',
  api_ref: 'NR-abc12345-1700000000000',
  challenge: 'test-challenge',
};

describe('verifyWebhookEvent', () => {
  it('accepts an event whose challenge matches', () => {
    const check = verifyWebhookEvent(VALID_EVENT, 'test-challenge');
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.event.api_ref).toBe(VALID_EVENT.api_ref);
  });

  it('rejects a mismatched challenge', () => {
    const check = verifyWebhookEvent(VALID_EVENT, 'wrong-challenge');
    expect(check).toEqual({ ok: false, reason: 'Invalid webhook challenge.' });
  });

  it('rejects when the challenge is not configured', () => {
    expect(verifyWebhookEvent(VALID_EVENT, '')).toEqual({
      ok: false,
      reason: 'Webhook challenge is not configured.',
    });
  });

  it('rejects non-object payloads', () => {
    expect(verifyWebhookEvent('nope', 'test-challenge')).toEqual({
      ok: false,
      reason: 'Expected a JSON object.',
    });
  });

  it('rejects an event missing api_ref', () => {
    const { api_ref: _omit, ...rest } = VALID_EVENT;
    expect(verifyWebhookEvent(rest, 'test-challenge')).toEqual({
      ok: false,
      reason: 'Missing api_ref.',
    });
  });

  it('rejects an unknown state', () => {
    expect(verifyWebhookEvent({ ...VALID_EVENT, state: 'REFUNDED' }, 'test-challenge')).toEqual({
      ok: false,
      reason: 'Unknown state "REFUNDED".',
    });
  });
});

describe('chargeAmountFor', () => {
  it('absorbs the 3% M-Pesa fee by rounding up', () => {
    // 1500 / 0.97 = 1546.39… → 1547
    expect(chargeAmountFor(1500)).toBe(1547);
  });

  it('rounds up even at exact multiples', () => {
    expect(chargeAmountFor(970)).toBe(1000);
  });
});

describe('normalizeKenyanPhone', () => {
  it('converts the local 0-prefix format', () => {
    expect(normalizeKenyanPhone('0712 345 678')).toBe('254712345678');
  });

  it('keeps an already-international number', () => {
    expect(normalizeKenyanPhone('+254712345678')).toBe('254712345678');
    expect(normalizeKenyanPhone('254712345678')).toBe('254712345678');
  });

  it('rejects unparseable numbers', () => {
    expect(normalizeKenyanPhone('123')).toBeNull();
    expect(normalizeKenyanPhone('')).toBeNull();
  });
});

describe('intasendConfigured', () => {
  it('is false without keys', () => {
    vi.stubEnv('INTASEND_PUBLISHABLE_KEY', '');
    vi.stubEnv('INTASEND_SECRET_KEY', '');
    expect(intasendConfigured()).toBe(false);
  });

  it('is true with both keys', () => {
    vi.stubEnv('INTASEND_PUBLISHABLE_KEY', 'pk_test');
    vi.stubEnv('INTASEND_SECRET_KEY', 'sk_test');
    expect(intasendConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});
