import { describe, expect, it } from 'vitest';

import { buildListingWhere, computeRating, listingOrderBy } from '@/lib/query';

describe('buildListingWhere', () => {
  it('returns no conditions for an empty filter', () => {
    expect(buildListingWhere({})).toEqual([]);
  });

  it('adds one condition per active filter', () => {
    const where = buildListingWhere({
      size: '2br',
      neighborhood: 'Kilimani',
      minPrice: 10000,
      maxPrice: 50000,
    });
    expect(where).toHaveLength(4);
  });

  it('skips null/undefined optional filters', () => {
    expect(buildListingWhere({ size: 'studio', minPrice: null, maxPrice: undefined })).toHaveLength(1);
  });

  it('adds one containment condition per requested amenity', () => {
    const where = buildListingWhere({ amenities: ['Wi-Fi', 'Parking'] });
    expect(where).toHaveLength(2);
  });
});

describe('listingOrderBy', () => {
  it('supports all four sort modes', () => {
    expect(listingOrderBy('newest')).toHaveLength(1);
    expect(listingOrderBy('price-asc')).toHaveLength(1);
    expect(listingOrderBy('price-desc')).toHaveLength(1);
    expect(listingOrderBy('rating')).toHaveLength(2);
  });
});

describe('computeRating', () => {
  it('returns 0 with no reviews', () => {
    expect(computeRating([])).toEqual({ rating: 0, reviewCount: 0 });
  });

  it('averages stars to one decimal place', () => {
    expect(computeRating([{ stars: 5 }, { stars: 4 }])).toEqual({ rating: 4.5, reviewCount: 2 });
  });

  it('rounds to one decimal place', () => {
    // 5 + 5 + 4 = 14 → 4.666… → 4.7
    expect(computeRating([{ stars: 5 }, { stars: 5 }, { stars: 4 }])).toEqual({
      rating: 4.7,
      reviewCount: 3,
    });
  });
});
