# Location & Address Automation (Phase 4)

Cross-platform location assist for delivery addresses, PIN checks, and nearby shops.

## Modules

| Area | Path |
|------|------|
| Permissions + current position | [`lib/location/`](../lib/location/) |
| Places / geocode client | [`lib/location/places-client.ts`](../lib/location/places-client.ts) |
| Edge proxy (Google key server-side) | [`supabase/functions/places`](../supabase/functions/places/) |
| UI | [`components/location/`](../components/location/) |
| Saved addresses | [`lib/address/`](../lib/address/) |
| Offline country/state/city/PIN | [`lib/geo/`](../lib/geo/) |

## Platform permission matrix

| Capability | Web | Android | iOS |
|------------|-----|---------|-----|
| Current location | Browser Geolocation API | `expo-location` foreground | `expo-location` When-In-Use |
| Accuracy | `enableHighAccuracy` only when user needs precise pin | Fine + coarse | Approximate first, precise if reverse geocode is coarse |
| Background location | Never | Never (Phase 4) | Never (Phase 4) |
| Address autocomplete | Places via Edge Function + browser `autocomplete` attrs | Places + OS autofill attrs | Places + `textContentType` |
| Map pin | WebView / iframe static map nudge | WebView map nudge | WebView map nudge |
| Offline fallback | `LocationFields` (country-state-city) | Same | Same |

## Secrets

Set on the Supabase Edge Function `places`:

- `GOOGLE_MAPS_API_KEY` (or `GOOGLE_PLACES_API_KEY`)

Enable Google APIs: Places API, Geocoding API. Static Maps optional for pin preview.

Client never receives the Google server key.

## Schema

Migration [`20260715140000_addresses_geo_columns.sql`](../supabase/migrations/20260715140000_addresses_geo_columns.sql) adds to `addresses`:

- `latitude`, `longitude`, `place_id`, `source` (`manual` \| `places` \| `current_location` \| `map`)

## Surfaces

- Address manager drawer — autocomplete, use my location, map pin
- Checkout — same assist + recently used chips + PIN check
- Listing PDP — delivery PIN check for physical goods
- Shops browse — “Shops near you” via `get_nearby_shops_with_ratings`
- Marketplace ranking — boosts in-country / near-you listings (`marketplace-personalization`)

## Verification checklist

1. **Web** — Allow geo → Use my location fills city/PIN (when Places configured); search addresses; map pin confirm; PIN check shows available/not; region footer still independent.
2. **Android** — Foreground permission dialog only; current location + Places suggestions; no background permission used by this feature.
3. **iOS** — When-In-Use string present; approximate then precise if needed.
4. **No API key** — Autocomplete hides; forms still work with `LocationFields` + Zod postal validation.
5. **Digital listing** — PIN check shows instant digital delivery.

## Out of scope (later)

- Background / geofenced notifications
- Live courier map tracking
- Nearby community service-providers beyond shops
