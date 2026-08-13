/**
 * IntaSend M-Pesa integration (PLAN §5 — provider decided Aug 2026).
 *
 * Contract verified against the official IntaSend SDKs (Aug 2026):
 * - STK push:  POST {base}/api/v1/payment/mpesa-stk-push/
 *   headers:   Authorization: Bearer <secret_key>, INTASEND_PUBLIC_API_KEY: <publishable_key>
 *   body:      { public_key, currency: 'KES', method: 'M-PESA', amount,
 *                phone_number, api_ref, name, email, narrative }
 * - Base URL:  https://payment.intasend.com (live) / https://sandbox.intasend.com (test)
 * - Webhooks:  the payload embeds the `challenge` string you set on the IntaSend
 *   dashboard — verification is challenge equality + api_ref match (there is no
 *   HMAC header; this resolves the PLAN §4 build-time TODO). State field values:
 *   PENDING | PROCESSING | COMPLETE | FAILED.
 *
 * Graceful degradation (same pattern as Cloudinary): every function checks
 * configuration first, so the API works without keys and only the payment
 * endpoints report a clear "not configured" error.
 */

const LIVE_BASE_URL = 'https://payment.intasend.com';
const SANDBOX_BASE_URL = 'https://sandbox.intasend.com';

/** Default monthly price in KES (configurable — PLAN assumption #3). */
export const DEFAULT_SUBSCRIPTION_PRICE = 1500;
/** M-Pesa charges 3% on STK push; the realtor-facing price absorbs it. */
export const MPESA_FEE_RATIO = 0.03;
/** Length of one subscription period. */
export const SUBSCRIPTION_DAYS = 30;

/** Both IntaSend keys present → payments are live (or sandbox) configured. */
export function intasendConfigured(): boolean {
  return Boolean(
    process.env.INTASEND_PUBLISHABLE_KEY && process.env.INTASEND_SECRET_KEY,
  );
}

/** The listed monthly price (KES) — env override, sensible default otherwise. */
export function subscriptionPrice(): number {
  const raw = Number(process.env.REALTOR_SUBSCRIPTION_PRICE_KES ?? process.env.SUBSCRIPTION_PRICE_KES);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : DEFAULT_SUBSCRIPTION_PRICE;
}

/** What the STK push charges: listed price + 3% M-Pesa fee, rounded up (PLAN §3-8). */
export function chargeAmountFor(price: number): number {
  return Math.ceil(price / (1 - MPESA_FEE_RATIO));
}

function intasendBaseUrl(): string {
  return process.env.INTASEND_ENV === 'live' ? LIVE_BASE_URL : SANDBOX_BASE_URL;
}

export interface StkPushInput {
  amount: number;
  /** International format (2547…). */
  phoneNumber: string;
  apiRef: string;
  name?: string;
  email?: string;
  narrative?: string;
}

export interface StkPushResult {
  invoiceId: string | null;
  apiRef: string | null;
  state: string | null;
}

/** `0712 345 678` / `+254712345678` → `254712345678`; null if unparseable. */
export function normalizeKenyanPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  return null;
}

/**
 * Initiate an M-Pesa STK push to the customer's phone. Throws an Error with
 * the provider's message on failure; the caller turns it into a 502.
 */
export async function initiateStkPush(input: StkPushInput): Promise<StkPushResult> {
  const publishableKey = process.env.INTASEND_PUBLISHABLE_KEY;
  const secretKey = process.env.INTASEND_SECRET_KEY;
  if (!publishableKey || !secretKey) {
    throw new Error('IntaSend is not configured — add the INTASEND_* keys.');
  }

  const res = await fetch(`${intasendBaseUrl()}/api/v1/payment/mpesa-stk-push/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secretKey}`,
      INTASEND_PUBLIC_API_KEY: publishableKey,
    },
    body: JSON.stringify({
      public_key: publishableKey,
      currency: 'KES',
      method: 'M-PESA',
      amount: input.amount,
      phone_number: input.phoneNumber,
      api_ref: input.apiRef,
      name: input.name ?? '',
      email: input.email ?? '',
      narrative: input.narrative ?? 'Nairobi Rentals subscription',
    }),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON error body — fall through to the status-code message
  }

  if (!res.ok) {
    const message =
      (body as { detail?: string; error?: string })?.detail ??
      (body as { detail?: string; error?: string })?.error ??
      `IntaSend returned HTTP ${res.status}.`;
    throw new Error(message);
  }

  // The API returns the invoice nested under `invoice` (and some versions flat).
  const invoice =
    (body as { invoice?: Record<string, unknown> })?.invoice ??
    (body as Record<string, unknown>);
  return {
    invoiceId: (invoice.invoice_id as string) ?? null,
    apiRef: (invoice.api_ref as string) ?? null,
    state: (invoice.state as string) ?? null,
  };
}

/** IntaSend collection-event webhook payload (verified shape, Aug 2026). */
export interface IntaSendWebhookEvent {
  invoice_id?: string;
  api_ref?: string;
  state?: string;
  value?: string | number;
  net_amount?: string | number;
  amount?: string | number;
  currency?: string;
  failed_reason?: string | null;
  created_at?: string;
  challenge?: string;
}

/** State values IntaSend sends for collection events. */
export const INTASEND_STATES = ['PENDING', 'PROCESSING', 'COMPLETE', 'FAILED'] as const;
export type IntaSendState = (typeof INTASEND_STATES)[number];

export type WebhookCheck =
  | { ok: true; event: IntaSendWebhookEvent }
  | { ok: false; reason: string };

/**
 * Verify a webhook payload: the embedded `challenge` must match the secret set
 * on the IntaSend dashboard, and the event must carry the fields we need.
 * Pure — unit-tested in intasend.test.ts.
 */
export function verifyWebhookEvent(body: unknown, challenge: string): WebhookCheck {
  if (!challenge) return { ok: false, reason: 'Webhook challenge is not configured.' };
  if (typeof body !== 'object' || body === null) {
    return { ok: false, reason: 'Expected a JSON object.' };
  }
  const event = body as IntaSendWebhookEvent;
  if (event.challenge !== challenge) {
    return { ok: false, reason: 'Invalid webhook challenge.' };
  }
  if (typeof event.api_ref !== 'string' || event.api_ref.length === 0) {
    return { ok: false, reason: 'Missing api_ref.' };
  }
  if (!event.state || !INTASEND_STATES.includes(event.state as IntaSendState)) {
    return { ok: false, reason: `Unknown state "${event.state}".` };
  }
  return { ok: true, event };
}
