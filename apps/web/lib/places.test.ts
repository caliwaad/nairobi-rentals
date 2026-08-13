import { describe, expect, it, vi } from 'vitest';

import {
  buildStaticMapUrl,
  cacheKeyFor,
  haversineKm,
  isNearbyCacheFresh,
  NEARBY_CACHE_TTL_MS,
  NEARBY_CATEGORIES,
} from '@/lib/places';

describe('cacheKeyFor', () => {
  it('rounds lat/lng to 2 decimals for a stable grid cell', () => {
    expect(cacheKeyFor(-1.2864, 36.8172)).toBe('-1.29,36.82');
    expect(cacheKeyFor(-1.2836, 36.8211)).toBe('-1.28,36.82');
  });
});

describe('isNearbyCacheFresh', () => {
  it('is fresh within the TTL', () => {
    const now = new Date('2026-08-13T12:00:00Z');
    expect(isNearbyCacheFresh(new Date(now.getTime() - NEARBY_CACHE_TTL_MS + 1000), now)).toBe(true);
  });

  it('is stale after the TTL', () => {
    const now = new Date('2026-08-13T12:00:00Z');
    expect(isNearbyCacheFresh(new Date(now.getTime() - NEARBY_CACHE_TTL_MS), now)).toBe(false);
  });
});

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(-1.2864, 36.8172, -1.2864, 36.8172)).toBe(0);
  });

  it('computes a plausible Nairobi distance (Kilimani → CBD ≈ 3.5 km)', () => {
    const km = haversineKm(-1.2921, 36.7919, -1.2833, 36.8219);
    expect(km).toBeGreaterThan(3.2);
    expect(km).toBeLessThan(3.8);
  });
});

describe('buildStaticMapUrl', () => {
  it('returns null without a key', () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    expect(buildStaticMapUrl(-1.2864, 36.8172)).toBeNull();
    vi.unstubAllEnvs();
  });

  it('builds a URL with the pin marker and the key', () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'AIza-test');
    const url = buildStaticMapUrl(-1.2864, 36.8172);
    expect(url).toContain('https://maps.googleapis.com/maps/api/staticmap?');
    expect(url).toContain('center=-1.2864%2C36.8172');
    expect(url).toContain('markers=color%3Ared%7C-1.2864%2C36.8172');
    expect(url).toContain('key=AIza-test');
    vi.unstubAllEnvs();
  });
});

describe('NEARBY_CATEGORIES', () => {
  it('covers schools, churches, supermarkets and malls (user requirement)', () => {
    const types = NEARBY_CATEGORIES.map((c) => c.type);
    expect(types).toEqual(['school', 'church', 'supermarket', 'shopping_mall']);
  });
});
