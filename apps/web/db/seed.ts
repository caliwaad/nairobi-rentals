/**
 * One-time dev seed: wipes and repopulates the core tables.
 *
 * Reuses the exact 12 Nairobi listings the mobile app renders (imported from
 * the Expo workspace) so API and app agree on the demo data, plus demo
 * accounts: an admin, an approved realtor, and one tenant user per review.
 *
 * Usage (from apps/web, after adding DATABASE_URL to .env.local):
 *   npx tsx db/seed.ts
 */
import dotenv from 'dotenv';
import path from 'node:path';

// Load apps/web/.env.local first (dotenv default only reads .env).
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

import { SAMPLE_LISTINGS } from '../../mobile/src/data/sample-listings';
import { getDb } from './index';
import {
  favorites,
  listingImages,
  listings,
  reviews,
  users,
  type RealtorStatus,
} from './schema';

type DemoUser = {
  clerkId: string;
  username: string | null;
  name: string;
  role: 'user' | 'realtor' | 'admin';
  realtorStatus: RealtorStatus | null;
  phone?: string;
};

async function main() {
  const db = getDb();
  console.log('Clearing existing rows…');

  // FK-safe order.
  await db.delete(favorites);
  await db.delete(reviews);
  await db.delete(listingImages);
  await db.delete(listings);
  await db.delete(users);

  console.log('Seeding users…');

  // Demo accounts + one tenant per review username.
  const demoUsers: DemoUser[] = [
    { clerkId: 'demo-admin', username: 'admin', name: 'Demo Admin', role: 'admin', realtorStatus: null },
    { clerkId: 'demo-realtor', username: 'Njeri_W', name: 'Demo Realtor', role: 'realtor', realtorStatus: 'approved', phone: '0712 345 678' },
  ];

  const reviewUsernames = new Set<string>();
  for (const l of SAMPLE_LISTINGS) for (const r of l.reviews) reviewUsernames.add(r.username);
  for (const username of reviewUsernames) {
    demoUsers.push({
      clerkId: `demo-tenant-${username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      username,
      name: username,
      role: 'user',
      realtorStatus: null,
    });
  }

  const insertedUsers = await db.insert(users).values(demoUsers).returning();
  const userByUsername = new Map<string, string>();
  for (const u of insertedUsers) {
    if (u.username) userByUsername.set(u.username, u.id);
  }
  const realtorId = insertedUsers.find((u) => u.role === 'realtor')!.id;
  console.log(`  ${insertedUsers.length} users`);

  console.log('Seeding listings…');
  const listingRows = [];
  for (const l of SAMPLE_LISTINGS) {
    listingRows.push({
      realtorId,
      title: l.title,
      description: l.description,
      price: l.price,
      size: l.size,
      neighborhood: l.neighborhood,
      addressText: l.address,
      lat: l.lat,
      lng: l.lng,
      unitAmenities: l.amenities,
      houseRules: l.houseRules,
      status: 'approved' as const,
    });
  }
  const insertedListings = await db.insert(listings).values(listingRows).returning();
  console.log(`  ${insertedListings.length} listings`);

  console.log('Seeding listing images…');
  const imageRows: Array<{
    listingId: string;
    url: string;
    sortOrder: number;
    isCover: boolean;
  }> = [];
  insertedListings.forEach((listing, i) => {
    SAMPLE_LISTINGS[i].images.forEach((url, sortOrder) => {
      imageRows.push({ listingId: listing.id, url, sortOrder, isCover: sortOrder === 0 });
    });
  });
  await db.insert(listingImages).values(imageRows);
  console.log(`  ${imageRows.length} images`);

  console.log('Seeding reviews…');
  const reviewRows: Array<{
    listingId: string;
    userId: string;
    stars: number;
    comment: string | null;
  }> = [];
  insertedListings.forEach((listing, i) => {
    for (const r of SAMPLE_LISTINGS[i].reviews) {
      const userId = userByUsername.get(r.username);
      if (!userId) continue;
      reviewRows.push({ listingId: listing.id, userId, stars: r.stars, comment: r.comment });
    }
  });
  await db.insert(reviews).values(reviewRows);
  console.log(`  ${reviewRows.length} reviews`);

  console.log('\n✅ Seed complete.');
  console.log(
    `Admin: demo-admin · Realtor: demo-realtor (approved) · ${reviewUsernames.size} demo tenants`,
  );
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exitCode = 1;
  });
