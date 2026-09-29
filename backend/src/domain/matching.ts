/**
 * Match Score calculation - SRS Section 4.4.4.
 *
 * Everything in this file is a PURE function: it takes numbers/strings in and
 * returns a number out. It never touches the database or the network, which is
 * why it is easy to unit test (see tests/matching.*.test.ts).
 *
 * The order of the SRS is followed exactly:
 *   1. two rejection checks  -> score 0
 *   2. four similarity scores (colour, brand, date, location), each 0..100
 *   3. weighted average -> final Match Score, rounded to 0..100
 */

// ---------------------------------------------------------------------------
// The nine "similar colour" pairs listed in SRS 4.4.4.
// Stored as "A|B" strings with the two colours sorted alphabetically, so that
// looking up Blue+Navy and Navy+Blue both find the same entry.
// ---------------------------------------------------------------------------
const SIMILAR_COLOUR_PAIRS = new Set([
  key('BLACK', 'GREY'),
  key('WHITE', 'GREY'),
  key('RED', 'MAROON'),
  key('RED', 'PINK'),
  key('RED', 'ORANGE'),
  key('ORANGE', 'YELLOW'),
  key('BLUE', 'NAVY'),
  key('BLUE', 'PURPLE'),
  key('PINK', 'PURPLE'),
]);

function key(a: string, b: string): string {
  return [a, b].sort().join('|');
}

// ---------------------------------------------------------------------------
// Attribute weights - SRS 4.4.4 "Attribute Weights"
// ---------------------------------------------------------------------------
export const WEIGHT_COLOUR = 25;
export const WEIGHT_BRAND = 5;
export const WEIGHT_DATE = 30;
export const WEIGHT_LOCATION = 40;

/** Input for one report, trimmed down to only what matching needs. */
export interface MatchInput {
  category: string;
  colour: string;
  /** null means the user chose "Unknown" (REQ-16 / REQ-29). */
  brand: string | null;
  date: Date;
  latitude: number;
  longitude: number;
}

// ---------------------------------------------------------------------------
// 1. Similarity scores (each returns 0..100)
// ---------------------------------------------------------------------------

/** Colour similarity: 100 if identical, 50 if a listed similar pair, else 0. */
export function colourSimilarity(lost: string, found: string): number {
  if (lost === found) return 100;
  if (SIMILAR_COLOUR_PAIRS.has(key(lost, found))) return 50;
  return 0;
}

/**
 * Brand similarity: 100 if the brands match (case-insensitive), else 0.
 * Only called when BOTH brands are known - an unknown brand is excluded from
 * the calculation entirely (REQ-48), handled in calculateMatchScore below.
 */
export function brandSimilarity(lost: string, found: string): number {
  return lost.trim().toLowerCase() === found.trim().toLowerCase() ? 100 : 0;
}

/**
 * Date similarity: S_Date = 100 * 2^(-d/7), where d = dateFound - dateLost in days.
 * Same day (d = 0) scores 100; every extra week roughly halves the score.
 */
export function dateSimilarity(dateLost: Date, dateFound: Date): number {
  const d = daysBetween(dateLost, dateFound);
  return 100 * Math.pow(2, -d / 7);
}

/** Whole number of days from dateLost to dateFound (negative if found first). */
export function daysBetween(dateLost: Date, dateFound: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((dateFound.getTime() - dateLost.getTime()) / MS_PER_DAY);
}

/**
 * Location similarity: S_Location = 100 / (1 + x / 0.5), where x is the
 * distance in kilometres. 0 km scores 100, 0.5 km scores 50, 1.5 km scores 25.
 */
export function locationSimilarity(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const x = haversineKm(lat1, lon1, lat2, lon2);
  return 100 / (1 + x / 0.5);
}

/** Great-circle distance between two points, in kilometres (Haversine formula). */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const EARTH_RADIUS_KM = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// 2. The full Match Score
// ---------------------------------------------------------------------------

/**
 * Compares one Lost Item Report with one Found Item Report and returns a whole
 * number from 0 to 100 (REQ-45 to REQ-50).
 */
export function calculateMatchScore(lost: MatchInput, found: MatchInput): number {
  // --- Rejection check 1: the item cannot be found before it was lost (REQ-47)
  if (daysBetween(lost.date, found.date) < 0) return 0;

  // --- Rejection check 2: different categories can never match
  if (lost.category !== found.category) return 0;

  // --- Similarity scores
  const sColour = colourSimilarity(lost.colour, found.colour);
  const sDate = dateSimilarity(lost.date, found.date);
  const sLocation = locationSimilarity(
    lost.latitude,
    lost.longitude,
    found.latitude,
    found.longitude,
  );

  // --- Weighted average.
  // If either brand is "Unknown", brand is dropped and the remaining weights
  // are normalised by dividing by 95 instead of 100 (REQ-48).
  const brandIsKnown = lost.brand !== null && found.brand !== null;

  let score: number;
  if (brandIsKnown) {
    const sBrand = brandSimilarity(lost.brand as string, found.brand as string);
    score =
      (WEIGHT_COLOUR * sColour +
        WEIGHT_BRAND * sBrand +
        WEIGHT_DATE * sDate +
        WEIGHT_LOCATION * sLocation) /
      100;
  } else {
    score =
      (WEIGHT_COLOUR * sColour + WEIGHT_DATE * sDate + WEIGHT_LOCATION * sLocation) / 95;
  }

  // --- Round to the nearest whole number and keep it inside 0..100 (REQ-50)
  return clamp(Math.round(score), 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
