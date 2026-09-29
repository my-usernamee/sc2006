/**
 * OneMap integration (SRS 2.5, 3.3, REQ-14/15 and REQ-32/33).
 *
 * WHY THIS IS ON THE BACKEND:
 * OneMap's authenticated endpoints need a token tied to a real account. If the
 * browser called OneMap directly, that token would be visible to anyone using
 * the site. So the frontend calls our own API, and only this file talks to
 * OneMap, using credentials that stay in backend/.env.
 *
 * The map tiles the user sees are a separate, public service and need no
 * credentials - those are loaded directly in the browser by Leaflet.
 *
 * TOKENS:
 * A OneMap token expires after a few days. Rather than making someone paste a
 * new one into .env every few days, the backend logs in with ONEMAP_EMAIL and
 * ONEMAP_PASSWORD and keeps the token in memory, fetching a new one when it
 * runs out. If you would rather paste a token directly, set ONEMAP_TOKEN and
 * that is used instead.
 *
 * >>> If your OneMap documentation shows different URLs, change them here. <<<
 */
import { env } from '../config/env';
import { AppError, badRequest } from '../lib/errors';

const TOKEN_URL = 'https://www.onemap.gov.sg/api/auth/post/getToken';
const REVERSE_GEOCODE_URL = 'https://www.onemap.gov.sg/api/public/revgeocode';
const SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search';

/** The token we are currently using, and when it stops working. */
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Returns a usable OneMap token, logging in again if the old one has expired.
 * A minute of slack is subtracted so a token cannot expire mid-request.
 */
async function getToken(): Promise<string> {
  // Option A: a token was pasted straight into .env.
  if (env.oneMapToken) return env.oneMapToken;

  // Option B: log in with the account credentials.
  if (!env.oneMapEmail || !env.oneMapPassword) {
    throw new AppError(
      503,
      'OneMap is not configured. Set ONEMAP_EMAIL and ONEMAP_PASSWORD (or ONEMAP_TOKEN) in backend/.env.',
    );
  }

  const ONE_MINUTE = 60 * 1000;
  if (cachedToken && cachedToken.expiresAt - ONE_MINUTE > Date.now()) {
    return cachedToken.value;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.oneMapEmail, password: env.oneMapPassword }),
  });

  if (!response.ok) {
    throw new AppError(502, 'Could not sign in to OneMap. Check the credentials in backend/.env.');
  }

  const data = (await response.json()) as {
    access_token?: string;
    expiry_timestamp?: string;
  };

  if (!data.access_token) {
    throw new AppError(502, 'OneMap did not return an access token.');
  }

  // expiry_timestamp comes back in seconds; fall back to 1 day if it is missing.
  const expiresAt = data.expiry_timestamp
    ? Number(data.expiry_timestamp) * 1000
    : Date.now() + 24 * 60 * 60 * 1000;

  cachedToken = { value: data.access_token, expiresAt };
  return cachedToken.value;
}

/**
 * REQ-15 / REQ-33: turn the marker the user placed into a location name.
 * The coordinates are stored for matching; the name is what users see.
 */
export async function reverseGeocode(latitude: number, longitude: number) {
  const token = await getToken();

  const url = `${REVERSE_GEOCODE_URL}?location=${latitude},${longitude}&buffer=100&addressType=All`;
  const response = await fetch(url, { headers: { Authorization: token } });

  if (!response.ok) {
    throw new AppError(502, 'Could not look up that location. Please try again.');
  }

  const data = (await response.json()) as {
    GeocodeInfo?: Array<{ BUILDINGNAME?: string; ROAD?: string; BLOCK?: string }>;
  };

  const nearest = data.GeocodeInfo?.[0];

  // Prefer a building name, then the road, then fall back to the raw coordinates
  // so the user is never blocked from submitting a report.
  const locationName =
    nearest?.BUILDINGNAME && nearest.BUILDINGNAME !== 'NIL'
      ? nearest.BUILDINGNAME
      : (nearest?.ROAD ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);

  return { locationName, latitude, longitude };
}

/**
 * Optional convenience: search for a place by name so the user can jump the map
 * there instead of panning around. This OneMap endpoint is public, so it needs
 * no token - but we still proxy it to keep all OneMap traffic in one place.
 */
export async function searchPlaces(query: string) {
  if (!query.trim()) throw badRequest('Enter something to search for.');

  const url = `${SEARCH_URL}?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new AppError(502, 'Location search is unavailable right now.');
  }

  const data = (await response.json()) as {
    results?: Array<{
      SEARCHVAL: string;
      ADDRESS?: string;
      LATITUDE: string;
      LONGITUDE: string;
    }>;
  };

  return (data.results ?? []).slice(0, 8).map((r) => ({
    name: r.SEARCHVAL,
    address: r.ADDRESS ?? r.SEARCHVAL,
    latitude: Number(r.LATITUDE),
    longitude: Number(r.LONGITUDE),
  }));
}
