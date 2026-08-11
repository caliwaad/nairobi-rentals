import { z } from 'zod';

import { listingSizes } from '@/db/schema';

/**
 * API request validation (PLAN §8 — every body is Zod-validated before it
 * reaches the DB). These mirror the mobile app's Listing/Review shapes so the
 * API contract stays the single source of truth.
 */

export const listingQuerySchema = z.object({
  size: z.enum(listingSizes).optional().nullable(),
  neighborhood: z.string().trim().min(1).optional().nullable(),
  minPrice: z.coerce.number().int().nonnegative().optional().nullable(),
  maxPrice: z.coerce.number().int().nonnegative().optional().nullable(),
  amenities: z.string().optional(), // comma-separated
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'rating']).optional().default('newest'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(50).optional().default(20),
});

export const listingCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  price: z.number().int().positive().max(100_000_000),
  size: z.enum(listingSizes),
  neighborhood: z.string().trim().min(2).max(80),
  addressText: z.string().trim().max(200).optional().default(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  unitAmenities: z.array(z.string().trim().min(1).max(60)).max(30).optional().default([]),
  houseRules: z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
  images: z.array(z.string().url().max(1000)).min(1).max(10),
});

export const reviewUpsertSchema = z.object({
  listingId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().default(''),
});

export const mePatchSchema = z.object({
  username: z.string().trim().min(2).max(40).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  avatarUrl: z.string().url().max(1000).optional(),
});

/** Payload shape Clerk sends to our webhook (we only read the fields we need). */
export const clerkWebhookSchema = z.object({
  type: z.enum(['user.created', 'user.updated', 'user.deleted']),
  data: z.object({
    id: z.string(),
    username: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    email_addresses: z
      .array(z.object({ email_address: z.string().email() }))
      .min(0)
      .optional(),
    image_url: z.string().nullable().optional(),
    deleted: z.boolean().optional(),
  }),
});
