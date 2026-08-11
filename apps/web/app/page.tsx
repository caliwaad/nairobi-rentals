const ENDPOINTS: Array<[string, string]> = [
  ["GET  /api/listings", "Browse approved listings (size, neighbourhood, price, amenities, sort, pagination)"],
  ["GET  /api/listings/:id", "Listing detail with average rating + images"],
  ["GET  /api/listings/:id/reviews", "Public reviews with usernames"],
  ["POST /api/listings", "Publish a listing (approved realtor only, starts pending)"],
  ["POST /api/reviews", "Create / update a 1–5 star review (no self-reviews)"],
  ["GET  /api/favorites", "Your saved homes"],
  ["POST /api/favorites/:listingId", "Save a home"],
  ["DELETE /api/favorites/:listingId", "Unsave a home"],
  ["GET  /api/me", "Your profile"],
  ["PATCH /api/me", "Edit your profile"],
  ["POST /api/clerk/webhook", "Clerk user sync (Svix-verified)"],
];

export default function Home() {
  return (
    <main className="api-main">
      <h1>🏠 Nairobi Rentals API</h1>
      <p className="muted">
        REST backend for the Nairobi Rentals mobile app. The admin dashboard lands in Phase 6.
      </p>
      <table className="endpoint-table">
        <tbody>
          {ENDPOINTS.map(([method, desc]) => (
            <tr key={method}>
              <td className="mono">{method}</td>
              <td>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
