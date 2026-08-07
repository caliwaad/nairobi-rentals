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

export interface Review {
  username: string; // self-chosen display name (no real names / PII)
  stars: number; // 1–5
  comment: string;
  date: string; // e.g. 'Jul 2026'
}

export interface Listing {
  id: string;
  title: string;
  price: number; // KES per month
  size: ListingSize;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  rating: number; // 0–5
  reviewCount: number;
  amenities: string[];
  houseRules: string[];
  phone: string;
  whatsapp: string; // international digits, no '+'
  images: string[];
  description: string;
  reviews: Review[];
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

/** Plausible 5★→1★ counts from an average rating — demo stand-in for the real SQL view. */
export function buildRatingBreakdown(rating: number, reviewCount: number): number[] {
  const weights = [5, 4, 3, 2, 1].map((s) => Math.max(0.12, 1 - Math.abs(rating - s) * 0.5));
  const total = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.round((w / total) * reviewCount));
  counts[0] += reviewCount - counts.reduce((a, b) => a + b, 0);
  return counts;
}

export function whatsappLink(listing: Listing): string {
  const text = `Hello! I'm interested in ${listing.title} (${formatKES(listing.price)}/mo) on Nairobi Rentals.`;
  return `https://wa.me/${listing.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function telLink(listing: Listing): string {
  return `tel:${listing.phone.replace(/[^\d+]/g, '')}`;
}

/** Unsplash photo URL builder (stable photo IDs, auto-cropped). */
const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;

const A = img('photo-1522708323590-d24dbb6b0267');
const B = img('photo-1502672260266-1c1ef2d93688');
const C = img('photo-1493809842364-78817add7ffb');
const D = img('photo-1560448204-e02f11c3d0e2');
const E = img('photo-1560185007-cde436f6a4d0');
const F = img('photo-1554995207-c18c203602cb');
const G = img('photo-1586023492125-27b2c045efd7');
const H = img('photo-1618221195710-dd6b41faaea6');
const I = img('photo-1600585154340-be6161a56a0c');
const J = img('photo-1600607687939-ce8a6c25118c');
const K = img('photo-1600566753086-00f18fb6b3ea');
const L = img('photo-1512917774080-9991f1c4c750');
const M = img('photo-1449844908441-8829872d2607');
const N = img('photo-1479839672679-a46483c0e7c8');

export const SAMPLE_LISTINGS: Listing[] = [
  {
    id: 'lst-001',
    title: 'The Ivory Residences',
    price: 68000,
    size: '2br',
    neighborhood: 'Kilimani',
    address: 'Argwings Kodhek Rd',
    lat: -1.2878,
    lng: 36.7851,
    rating: 4.6,
    reviewCount: 34,
    amenities: ['Parking', 'Wi-Fi', 'Water', 'Gym', 'Backup generator', 'CCTV'],
    houseRules: ['No pets', 'Quiet hours after 10 pm', 'Notice period: 2 months'],
    phone: '0712 345 678',
    whatsapp: '254712345678',
    images: [A, B, C],
    description:
      'Modern 2-bedroom in the heart of Kilimani with gym, secure parking and back-up water. Five minutes from Yaya Centre and the many cafés of Argwings Kodhek.',
    reviews: [
      { username: 'Njeri W.', stars: 5, comment: 'Quiet compound, friendly caretakers and never had a power issue. Gym is a bonus!', date: 'Jul 2026' },
      { username: 'Kevo254', stars: 4, comment: 'Great location for work in the CBD. Parking is a bit tight on weekends.', date: 'May 2026' },
      { username: 'Amara', stars: 4, comment: 'Clean, secure and the backup water is a lifesaver in Kilimani.', date: 'Mar 2026' },
    ],
  },
  {
    id: 'lst-002',
    title: 'Sunview Apartments',
    price: 15500,
    size: 'bedsitter',
    neighborhood: 'South B',
    address: 'Mombasa Rd',
    lat: -1.3153,
    lng: 36.8525,
    rating: 3.9,
    reviewCount: 18,
    amenities: ['Water', 'Security'],
    houseRules: ['No visitors after 11 pm', 'Rent due by the 5th'],
    phone: '0733 111 222',
    whatsapp: '254733111222',
    images: [D, E],
    description:
      'Affordable bedsitter close to the South B estate, ideal for students and first jobbers. Easy matatu access along Mombasa Road.',
    reviews: [
      { username: 'Brenda', stars: 4, comment: 'Perfect for a student budget. Water is consistent.', date: 'Jun 2026' },
      { username: 'Omondi_J', stars: 3, comment: 'Thin walls but the price is right for South B.', date: 'Apr 2026' },
    ],
  },
  {
    id: 'lst-003',
    title: 'Westlands Green Court',
    price: 45000,
    size: '1br',
    neighborhood: 'Westlands',
    address: 'Waiyaki Way',
    lat: -1.267,
    lng: 36.809,
    rating: 4.3,
    reviewCount: 27,
    amenities: ['Parking', 'Wi-Fi', 'Backup generator', 'Water'],
    houseRules: ['No smoking indoors', 'One reserved parking slot'],
    phone: '0722 555 889',
    whatsapp: '254722555889',
    images: [F, G],
    description:
      'One-bedroom with open-plan kitchen, seconds from the Westlands business district and Sarit Centre.',
    reviews: [
      { username: 'Wanjiru', stars: 5, comment: 'Walking distance to everything in Westlands. Generous natural light.', date: 'Jul 2026' },
      { username: 'M. Otieno', stars: 4, comment: 'Wi-Fi is fast and the generator never lets us down.', date: 'Feb 2026' },
      { username: 'Sasha', stars: 4, comment: 'Landlord is responsive. Neighbours are quiet professionals.', date: 'Jan 2026' },
    ],
  },
  {
    id: 'lst-004',
    title: 'Cedar Heights Studio',
    price: 22000,
    size: 'studio',
    neighborhood: 'Kileleshwa',
    address: 'Kibagare Rd',
    lat: -1.277,
    lng: 36.7815,
    rating: 4.1,
    reviewCount: 12,
    amenities: ['Water', 'Security', 'Wi-Fi'],
    houseRules: ['No pets', 'Common area cleaning rotates weekly'],
    phone: '0740 909 111',
    whatsapp: '254740909111',
    images: [H, K],
    description:
      'Compact studio in quiet Kileleshwa with gated security and ample parking. A short walk to Riverside and the river trail.',
    reviews: [
      { username: 'Kevin', stars: 5, comment: 'Best value studio in Kileleshwa. Gated and very safe at night.', date: 'May 2026' },
      { username: 'Zawadi', stars: 4, comment: 'Cosy and well maintained. Kitchen is small but works.', date: 'Feb 2026' },
    ],
  },
  {
    id: 'lst-005',
    title: 'Lavington Oasis',
    price: 95000,
    size: '3br',
    neighborhood: 'Lavington',
    address: 'Gitanga Rd',
    lat: -1.2795,
    lng: 36.774,
    rating: 4.8,
    reviewCount: 41,
    amenities: ['Parking', 'Gym', 'Wi-Fi', 'Water', 'Backup generator', 'Garden'],
    houseRules: ['No Airbnb subletting', 'Notice period: 3 months'],
    phone: '0711 232 434',
    whatsapp: '254711232434',
    images: [J, L],
    description:
      'Spacious 3-bedroom townhouse in leafy Lavington with gym, private garden and 24/7 security. Close to Braeburn and Strathmore.',
    reviews: [
      { username: 'Maina', stars: 5, comment: 'The garden and gym make it feel like a resort. Best home we have rented.', date: 'Jul 2026' },
      { username: 'Achieng', stars: 5, comment: 'Excellent security and management. Schools nearby for the kids.', date: 'Apr 2026' },
      { username: 'Tito', stars: 4, comment: 'Slightly pricey but worth every shilling.', date: 'Jan 2026' },
    ],
  },
  {
    id: 'lst-006',
    title: 'Ruaka Skyline Suites',
    price: 28500,
    size: '1br',
    neighborhood: 'Ruaka',
    address: 'Limuru Rd',
    lat: -1.209,
    lng: 36.77,
    rating: 4.0,
    reviewCount: 15,
    amenities: ['Parking', 'Water', 'Backup generator'],
    houseRules: ['No overnight guests without notice'],
    phone: '0700 808 606',
    whatsapp: '254700808606',
    images: [N, C],
    description:
      'Riverside 1-bedroom in fast-growing Ruaka with skyline views over the Limuru road and easy access to Two Rivers Mall.',
    reviews: [
      { username: 'Faith N.', stars: 4, comment: 'Views are amazing, and Two Rivers is minutes away.', date: 'Jun 2026' },
      { username: 'Dennis K.', stars: 4, comment: 'New building, everything works. Parking is easy.', date: 'Mar 2026' },
    ],
  },
  {
    id: 'lst-007',
    title: 'Kasarani Spring Gardens',
    price: 32000,
    size: '2br',
    neighborhood: 'Kasarani',
    address: 'Mwiki Rd',
    lat: -1.225,
    lng: 36.899,
    rating: 3.7,
    reviewCount: 9,
    amenities: ['Water', 'Security'],
    houseRules: ['Quiet hours after 10 pm', 'Rent due by the 5th'],
    phone: '0755 444 777',
    whatsapp: '254755444777',
    images: [M, B],
    description:
      'Family-friendly 2-bedroom near Kasarani stadium with a shared green courtyard and plenty of space for kids.',
    reviews: [
      { username: 'Carol', stars: 4, comment: 'Good family estate, kids love the courtyard.', date: 'May 2026' },
      { username: 'Meshack', stars: 3, comment: 'Decent home, parking can fill up on weekends.', date: 'Feb 2026' },
    ],
  },
  {
    id: 'lst-008',
    title: 'Parklands Heritage House',
    price: 120000,
    size: '4br',
    neighborhood: 'Parklands',
    address: 'Forest Rd',
    lat: -1.263,
    lng: 36.817,
    rating: 4.5,
    reviewCount: 22,
    amenities: ['Parking', 'Gym', 'Wi-Fi', 'Water', 'Backup generator', 'CCTV'],
    houseRules: ['No pets', 'Notice period: 3 months'],
    phone: '0729 666 000',
    whatsapp: '254729666000',
    images: [I, F],
    description:
      'Elegant 4-bedroom in Parklands with CCTV, gym and reserved parking for two cars. Minutes from Diamond Plaza.',
    reviews: [
      { username: 'Ivy', stars: 5, comment: 'Elegant finishes and superb security. The gym is spotless.', date: 'Jun 2026' },
      { username: 'Papa Tony', stars: 4, comment: 'Great for a family with two cars. Location is central to everything.', date: 'Apr 2026' },
      { username: 'Rachael', stars: 4, comment: 'Management responds quickly to maintenance requests.', date: 'Dec 2025' },
    ],
  },
  {
    id: 'lst-009',
    title: "Lang'ata Savannah Villas",
    price: 85000,
    size: 'maisonette',
    neighborhood: "Lang'ata",
    address: 'Magadi Rd',
    lat: -1.36,
    lng: 36.734,
    rating: 4.4,
    reviewCount: 19,
    amenities: ['Parking', 'Water', 'Security', 'Garden', 'Backup generator'],
    houseRules: ['No dogs in the compound', 'Common borehole water'],
    phone: '0703 222 111',
    whatsapp: '254703222111',
    images: [K, E],
    description:
      'Double-storey maisonette with a private garden near the Giraffe Centre. Peaceful, green and secure.',
    reviews: [
      { username: 'Gathoni', stars: 5, comment: 'The garden is gorgeous and the estate is so quiet.', date: 'Jul 2026' },
      { username: 'Sammy K.', stars: 4, comment: 'Lovely neighbours, strong community feel.', date: 'Mar 2026' },
    ],
  },
  {
    id: 'lst-010',
    title: 'Upper Hill Executive',
    price: 150000,
    size: '4br+',
    neighborhood: 'Upper Hill',
    address: 'Valley Rd',
    lat: -1.2965,
    lng: 36.8185,
    rating: 4.7,
    reviewCount: 16,
    amenities: ['Parking', 'Gym', 'Wi-Fi', 'Water', 'Backup generator', 'CCTV'],
    houseRules: ['No short-term subletting', 'Notice period: 3 months'],
    phone: '0720 888 999',
    whatsapp: '254720888999',
    images: [H, L],
    description:
      'Premium 5-bedroom executive residence overlooking the Upper Hill skyline, steps from the banking district.',
    reviews: [
      { username: 'Wambui', stars: 5, comment: 'Stunning views and top-tier finishes. Perfect for executives.', date: 'May 2026' },
      { username: 'Jake M.', stars: 5, comment: 'Security is excellent — very discreet and professional.', date: 'Feb 2026' },
      { username: 'Lulu', stars: 4, comment: 'Premium price but the location is unbeatable.', date: 'Nov 2025' },
    ],
  },
  {
    id: 'lst-011',
    title: 'Runda Country Estate',
    price: 180000,
    size: 'standalone',
    neighborhood: 'Runda',
    address: 'Kiambu Rd',
    lat: -1.235,
    lng: 36.862,
    rating: 4.9,
    reviewCount: 8,
    amenities: ['Parking', 'Garden', 'Security', 'Backup generator', 'Borehole water'],
    houseRules: ['Gardener provided once a week', 'Quiet hours after 10 pm'],
    phone: '0715 333 444',
    whatsapp: '254715333444',
    images: [L, I],
    description:
      'Standalone family home in exclusive Runda with a large compound, borehole water and mature gardens.',
    reviews: [
      { username: 'Oscar', stars: 5, comment: 'Dream home for a family. The compound is huge and so private.', date: 'Jun 2026' },
      { username: 'Mwende', stars: 5, comment: 'Worth every shilling — Runda living at its best.', date: 'Apr 2026' },
    ],
  },
  {
    id: 'lst-012',
    title: 'Ngong Road Nest',
    price: 18000,
    size: 'studio',
    neighborhood: 'Ngong Road',
    address: 'Kikuyu Rd',
    lat: -1.323,
    lng: 36.76,
    rating: 4.2,
    reviewCount: 11,
    amenities: ['Wi-Fi', 'Water'],
    houseRules: ['No visitors after 11 pm'],
    phone: '0741 010 202',
    whatsapp: '254741010202',
    images: [C, A],
    description:
      'Cosy studio along Ngong Road with fast Wi-Fi, minutes from Kenyatta National Hospital and Prestige Plaza.',
    reviews: [
      { username: 'Dr. Kibet', stars: 5, comment: 'Ideal for a hospital staff member — five minutes from KNH.', date: 'Jul 2026' },
      { username: 'Neema', stars: 4, comment: 'Fast Wi-Fi and water is reliable. Small but very neat.', date: 'Mar 2026' },
    ],
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
