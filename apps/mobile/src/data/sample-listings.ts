/**
 * Sample listings — placeholder data until the Phase 3 API + Phase 1 seed are live.
 * Shape mirrors the PLAN.md `listings` model so swapping in real data later is trivial.
 */

export type ListingSize =
  | 'bedsitter'
  | 'studio'
  | '1br'
  | '2br'
  | '3br'
  | '4br'
  | '4br+'
  | 'maisonette'
  | 'standalone';

export const SIZES: ListingSize[] = [
  'bedsitter',
  'studio',
  '1br',
  '2br',
  '3br',
  '4br',
  '4br+',
  'maisonette',
  'standalone',
];

export const SIZE_LABELS: Record<ListingSize, string> = {
  bedsitter: 'Bedsitter',
  studio: 'Studio',
  '1br': '1 BR',
  '2br': '2 BR',
  '3br': '3 BR',
  '4br': '4 BR',
  '4br+': '4 BR+',
  maisonette: 'Maisonette',
  standalone: 'Standalone',
};

export interface Listing {
  id: string;
  title: string;
  price: number; // KES per month
  size: ListingSize;
  neighborhood: string;
  address: string;
  rating: number; // 0–5
  reviewCount: number;
  amenities: string[];
  images: string[];
  description: string;
}

export interface ListingFilters {
  size: ListingSize | null;
  maxPrice: number | null;
  neighborhood: string | null;
}

export const EMPTY_FILTERS: ListingFilters = { size: null, maxPrice: null, neighborhood: null };

export function formatKES(amount: number): string {
  // Regex thousands separator — avoids any Hermes/Intl locale surprises on Android.
  return `KSh ${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** Single source of truth for the browse filtering rules (shared by list + filter sheet). */
export function matchesListing(listing: Listing, filters: ListingFilters): boolean {
  if (filters.size && listing.size !== filters.size) return false;
  if (filters.maxPrice !== null && listing.price > filters.maxPrice) return false;
  if (filters.neighborhood && listing.neighborhood !== filters.neighborhood) return false;
  return true;
}

export function countMatching(filters: ListingFilters): number {
  return SAMPLE_LISTINGS.filter((listing) => matchesListing(listing, filters)).length;
}

/** Unsplash photo URL builder (stable photo IDs, auto-cropped). */
const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;

export const SAMPLE_LISTINGS: Listing[] = [
  {
    id: 'lst-001',
    title: 'The Ivory Residences',
    price: 68000,
    size: '2br',
    neighborhood: 'Kilimani',
    address: 'Argwings Kodhek Rd',
    rating: 4.6,
    reviewCount: 34,
    amenities: ['Parking', 'Wi-Fi', 'Water', 'Gym'],
    images: [
      img('photo-1522708323590-d24dbb6b0267'),
      img('photo-1502672260266-1c1ef2d93688'),
      img('photo-1493809842364-78817add7ffb'),
    ],
    description: 'Modern 2-bedroom in the heart of Kilimani with gym, secure parking and back-up water.',
  },
  {
    id: 'lst-002',
    title: 'Sunview Apartments',
    price: 15500,
    size: 'bedsitter',
    neighborhood: 'South B',
    address: 'Mombasa Rd',
    rating: 3.9,
    reviewCount: 18,
    amenities: ['Water', 'Security'],
    images: [
      img('photo-1560448204-e02f11c3d0e2'),
      img('photo-1560185007-cde436f6a4d0'),
    ],
    description: 'Affordable bedsitter close to the South B estate, ideal for students and first jobbers.',
  },
  {
    id: 'lst-003',
    title: 'Westlands Green Court',
    price: 45000,
    size: '1br',
    neighborhood: 'Westlands',
    address: 'Waiyaki Way',
    rating: 4.3,
    reviewCount: 27,
    amenities: ['Parking', 'Wi-Fi', 'Backup generator'],
    images: [
      img('photo-1554995207-c18c203602cb'),
      img('photo-1586023492125-27b2c045efd7'),
    ],
    description: 'One-bedroom with open-plan kitchen, seconds from Westlands business district.',
  },
  {
    id: 'lst-004',
    title: 'Cedar Heights Studio',
    price: 22000,
    size: 'studio',
    neighborhood: 'Kileleshwa',
    address: 'Kibagare Rd',
    rating: 4.1,
    reviewCount: 12,
    amenities: ['Water', 'Security', 'Wi-Fi'],
    images: [
      img('photo-1618221195710-dd6b41faaea6'),
      img('photo-1600566753086-00f18fb6b3ea'),
    ],
    description: 'Compact studio in quiet Kileleshwa with gated security and ample parking.',
  },
  {
    id: 'lst-005',
    title: 'Lavington Oasis',
    price: 95000,
    size: '3br',
    neighborhood: 'Lavington',
    address: 'Gitanga Rd',
    rating: 4.8,
    reviewCount: 41,
    amenities: ['Parking', 'Gym', 'Wi-Fi', 'Water', 'Backup generator'],
    images: [
      img('photo-1600607687939-ce8a6c25118c'),
      img('photo-1512917774080-9991f1c4c750'),
    ],
    description: 'Spacious 3-bedroom townhouse in leafy Lavington with gym and 24/7 security.',
  },
  {
    id: 'lst-006',
    title: 'Ruaka Skyline Suites',
    price: 28500,
    size: '1br',
    neighborhood: 'Ruaka',
    address: 'Limuru Rd',
    rating: 4.0,
    reviewCount: 15,
    amenities: ['Parking', 'Water', 'Backup generator'],
    images: [
      img('photo-1479839672679-a46483c0e7c8'),
      img('photo-1493809842364-78817add7ffb'),
    ],
    description: 'Riverside 1-bedroom in fast-growing Ruaka with skyline views over the Limuru road.',
  },
  {
    id: 'lst-007',
    title: 'Kasarani Spring Gardens',
    price: 32000,
    size: '2br',
    neighborhood: 'Kasarani',
    address: 'Mwiki Rd',
    rating: 3.7,
    reviewCount: 9,
    amenities: ['Water', 'Security'],
    images: [
      img('photo-1449844908441-8829872d2607'),
      img('photo-1502672260266-1c1ef2d93688'),
    ],
    description: 'Family-friendly 2-bedroom near Kasarani stadium with a shared green courtyard.',
  },
  {
    id: 'lst-008',
    title: 'Parklands Heritage House',
    price: 120000,
    size: '4br',
    neighborhood: 'Parklands',
    address: 'Forest Rd',
    rating: 4.5,
    reviewCount: 22,
    amenities: ['Parking', 'Gym', 'Wi-Fi', 'Water', 'Backup generator', 'CCTV'],
    images: [
      img('photo-1600585154340-be6161a56a0c'),
      img('photo-1554995207-c18c203602cb'),
    ],
    description: 'Elegant 4-bedroom in Parklands with CCTV, gym and reserved parking for two cars.',
  },
  {
    id: 'lst-009',
    title: "Lang'ata Savannah Villas",
    price: 85000,
    size: 'maisonette',
    neighborhood: "Lang'ata",
    address: 'Magadi Rd',
    rating: 4.4,
    reviewCount: 19,
    amenities: ['Parking', 'Water', 'Security', 'Garden'],
    images: [
      img('photo-1600566753086-00f18fb6b3ea'),
      img('photo-1560185007-cde436f6a4d0'),
    ],
    description: 'Double-storey maisonette with private garden near the Giraffe Centre.',
  },
  {
    id: 'lst-010',
    title: 'Upper Hill Executive',
    price: 150000,
    size: '4br+',
    neighborhood: 'Upper Hill',
    address: 'Valley Rd',
    rating: 4.7,
    reviewCount: 16,
    amenities: ['Parking', 'Gym', 'Wi-Fi', 'Water', 'Backup generator', 'CCTV'],
    images: [
      img('photo-1618221195710-dd6b41faaea6'),
      img('photo-1512917774080-9991f1c4c750'),
    ],
    description: 'Premium 5-bedroom executive residence overlooking the Upper Hill skyline.',
  },
  {
    id: 'lst-011',
    title: 'Runda Country Estate',
    price: 180000,
    size: 'standalone',
    neighborhood: 'Runda',
    address: 'Kiambu Rd',
    rating: 4.9,
    reviewCount: 8,
    amenities: ['Parking', 'Garden', 'Security', 'Backup generator'],
    images: [
      img('photo-1512917774080-9991f1c4c750'),
      img('photo-1600585154340-be6161a56a0c'),
    ],
    description: 'Standalone family home in exclusive Runda with large compound and borehole water.',
  },
  {
    id: 'lst-012',
    title: 'Ngong Road Nest',
    price: 18000,
    size: 'studio',
    neighborhood: 'Ngong Road',
    address: 'Kikuyu Rd',
    rating: 4.2,
    reviewCount: 11,
    amenities: ['Wi-Fi', 'Water'],
    images: [
      img('photo-1493809842364-78817add7ffb'),
      img('photo-1522708323590-d24dbb6b0267'),
    ],
    description: 'Cosy studio along Ngong Road with fast Wi-Fi, minutes from Kenyatta National Hospital.',
  },
];

export const NEIGHBORHOODS: string[] = [
  ...new Set(SAMPLE_LISTINGS.map((l) => l.neighborhood)),
];

export interface PricePreset {
  label: string;
  value: number | null;
}

export const PRICE_PRESETS: PricePreset[] = [
  { label: 'Any', value: null },
  { label: 'Up to KSh 25K', value: 25000 },
  { label: 'Up to KSh 50K', value: 50000 },
  { label: 'Up to KSh 100K', value: 100000 },
  { label: 'Up to KSh 150K', value: 150000 },
];
