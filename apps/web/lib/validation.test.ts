import { describe, expect, it } from 'vitest';

import {
  clerkWebhookSchema,
  listingCreateSchema,
  listingQuerySchema,
  reviewUpsertSchema,
} from '@/lib/validation';

describe('reviewUpsertSchema', () => {
  it('accepts stars 1–5 with a comment', () => {
    const parsed = reviewUpsertSchema.safeParse({
      listingId: '11111111-1111-4111-8111-111111111111',
      stars: 4,
      comment: 'Great place',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects 0, 6, and non-integers', () => {
    expect(reviewUpsertSchema.safeParse({ listingId: '11111111-1111-4111-8111-111111111111', stars: 0 }).success).toBe(false);
    expect(reviewUpsertSchema.safeParse({ listingId: '11111111-1111-4111-8111-111111111111', stars: 6 }).success).toBe(false);
    expect(reviewUpsertSchema.safeParse({ listingId: '11111111-1111-4111-8111-111111111111', stars: 3.5 }).success).toBe(false);
  });

  it('rejects a malformed listing id', () => {
    expect(reviewUpsertSchema.safeParse({ listingId: 'nope', stars: 4 }).success).toBe(false);
  });
});

describe('listingQuerySchema', () => {
  it('coerces string query values', () => {
    const parsed = listingQuerySchema.safeParse({
      size: '2br',
      minPrice: '10000',
      maxPrice: '50000',
      sort: 'price-asc',
      page: '2',
      pageSize: '10',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.minPrice).toBe(10000);
      expect(parsed.data.page).toBe(2);
      expect(parsed.data.sort).toBe('price-asc');
    }
  });

  it('rejects invalid sizes and sorts', () => {
    expect(listingQuerySchema.safeParse({ size: 'huge' }).success).toBe(false);
    expect(listingQuerySchema.safeParse({ sort: 'random' }).success).toBe(false);
  });

  it('caps pageSize at 50', () => {
    expect(listingQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('listingCreateSchema', () => {
  const base = {
    title: 'Kilimani Sunrise Apartments',
    description: 'A bright two-bedroom close to Yaya Centre with parking.',
    price: 45000,
    size: '2br',
    neighborhood: 'Kilimani',
    addressText: 'Argwings Kodhek Rd',
    lat: -1.2878,
    lng: 36.7851,
    images: ['https://images.example.com/a.jpg'],
  };

  it('accepts a complete listing', () => {
    expect(listingCreateSchema.safeParse(base).success).toBe(true);
  });

  it('requires at least one image', () => {
    expect(listingCreateSchema.safeParse({ ...base, images: [] }).success).toBe(false);
  });

  it('rejects non-positive rent', () => {
    expect(listingCreateSchema.safeParse({ ...base, price: 0 }).success).toBe(false);
  });
});

describe('clerkWebhookSchema', () => {
  it('parses a user.created payload', () => {
    const parsed = clerkWebhookSchema.safeParse({
      type: 'user.created',
      data: {
        id: 'user_2abc',
        username: 'njeri_w',
        first_name: 'Njeri',
        email_addresses: [{ email_address: 'njeri@example.com' }],
        image_url: 'https://img.clerk.com/x.png',
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('ignores non-user events (acknowledged, not stored)', () => {
    expect(clerkWebhookSchema.safeParse({ type: 'session.created', data: {} }).success).toBe(false);
  });
});
