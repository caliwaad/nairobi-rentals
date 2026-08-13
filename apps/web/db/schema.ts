import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * PLAN.md §7 data model — core tables (subscriptions arrived with Phase 5,
 * nearby_places_cache with the maps work).
 *
 * Hard rule (PLAN §6): this schema is only ever written through the API
 * routes in this app — no direct DB access from the mobile client.
 */

export const userRoles = ['user', 'realtor', 'admin'] as const;
export const realtorStatuses = ['pending', 'approved', 'rejected'] as const;
export const listingSizes = [
  'bedsitter',
  'studio',
  '1br',
  '2br',
  '3br',
  '4br',
  '4br+',
  'maisonette',
  'standalone',
] as const;
export const listingStatuses = ['pending', 'approved', 'rejected', 'archived'] as const;
export const subscriptionStatuses = ['pending', 'active', 'expired', 'failed'] as const;

export type UserRole = (typeof userRoles)[number];
export type RealtorStatus = (typeof realtorStatuses)[number];
export type ListingSize = (typeof listingSizes)[number];
export type ListingStatus = (typeof listingStatuses)[number];
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Clerk user id — the auth identity; unique per account. */
  clerkId: text('clerk_id').notNull().unique(),
  /** Self-chosen display name, shown on reviews (decision #12 — no real names/PII). */
  username: text('username'),
  name: text('name'),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  /** Kept for realtors only (KDPA — assumption #10). */
  phone: text('phone'),
  role: text('role', { enum: userRoles }).notNull().default('user'),
  realtorStatus: text('realtor_status', { enum: realtorStatuses }),
  /** Visible to the realtor when their application is rejected. */
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    realtorId: uuid('realtor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    /** KES per month. */
    price: integer('price').notNull(),
    size: text('size', { enum: listingSizes }).notNull(),
    /** Reserved for future sale listings (decision #10). */
    listingType: text('listing_type', { enum: ['rent'] }).notNull().default('rent'),
    neighborhood: text('neighborhood').notNull(),
    addressText: text('address_text'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    unitAmenities: text('unit_amenities')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    houseRules: text('house_rules')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Pending until admin approval (decision #6). */
    status: text('status', { enum: listingStatuses }).notNull().default('pending'),
    rejectionReason: text('rejection_reason'),
    featured: boolean('featured').notNull().default(false),
    views: integer('views').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('listings_status_idx').on(t.status),
    index('listings_neighborhood_idx').on(t.neighborhood),
    index('listings_price_idx').on(t.price),
  ],
);

export const listingImages = pgTable(
  'listing_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    /** Cloudinary public_id once Phase 5 signed uploads land; null for seed URLs. */
    cloudinaryPublicId: text('cloudinary_public_id'),
    url: text('url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isCover: boolean('is_cover').notNull().default(false),
  },
  (t) => [index('listing_images_listing_idx').on(t.listingId)],
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 1–5, validated in Zod and by DB check. */
    stars: integer('stars').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('reviews_listing_user_unique').on(t.listingId, t.userId),
    index('reviews_listing_idx').on(t.listingId),
  ],
);

export const nearbyPlacesCache = pgTable(
  'nearby_places_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Rounded "lat,lng" grid key — the cost-saver (PLAN §7, assumption #5). */
    key: text('key').notNull().unique(),
    /** Normalized nearby-places array (what GET /api/listings/:id/nearby returns). */
    payload: jsonb('payload').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('nearby_cache_key_idx').on(t.key)],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

/**
 * One row per realtor — the latest subscription state (PLAN §7).
 * M-Pesa has no auto-recurring: each renewal is a fresh STK push (Phase 5),
 * so `history` keeps the full payment trail for audits + renewal reminders.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    realtorId: uuid('realtor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** IntaSend api_ref — the idempotency key webhook events are matched on. */
    providerRef: text('provider_ref'),
    /** IntaSend invoice id (informational — api_ref is the source of truth). */
    invoiceId: text('invoice_id'),
    status: text('status', { enum: subscriptionStatuses }).notNull().default('pending'),
    /** KES actually charged (listed price + 3% M-Pesa fee, rounded up). */
    amount: integer('amount').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    lastPaymentAt: timestamp('last_payment_at', { withTimezone: true }),
    /** JSON array of past payment events (audits + renewal reminders). */
    history: jsonb('history').notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('subscriptions_realtor_unique').on(t.realtorId),
    index('subscriptions_status_idx').on(t.status),
  ],
);
