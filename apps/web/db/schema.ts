import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * PLAN.md §7 data model — core tables only for now.
 * `subscriptions` and `nearby_places_cache` arrive with Phases 5 & 7.
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

export type UserRole = (typeof userRoles)[number];
export type RealtorStatus = (typeof realtorStatuses)[number];
export type ListingSize = (typeof listingSizes)[number];
export type ListingStatus = (typeof listingStatuses)[number];

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
