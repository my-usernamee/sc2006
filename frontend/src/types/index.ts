/** Shapes returned by the backend API. Kept in one file so they are easy to find. */

export const CATEGORIES = [
  'ELECTRONICS',
  'STATIONERY',
  'CLOTHING',
  'BAGS',
  'ACCESSORIES',
  'CARDS_DOCUMENTS',
  'BOTTLES_CONTAINERS',
  'KEYS',
  'UMBRELLAS',
  'SPORTS_EQUIPMENT',
  'OTHER',
] as const;

export const COLOURS = [
  'BLACK',
  'WHITE',
  'GREY',
  'RED',
  'MAROON',
  'PINK',
  'ORANGE',
  'YELLOW',
  'GREEN',
  'BLUE',
  'NAVY',
  'PURPLE',
  'BROWN',
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Colour = (typeof COLOURS)[number];

/** Turns ELECTRONICS into "Electronics" and CARDS_DOCUMENTS into "Cards/Documents". */
export function prettyLabel(value: string): string {
  const special: Record<string, string> = {
    CARDS_DOCUMENTS: 'Cards/Documents',
    BOTTLES_CONTAINERS: 'Bottles/Containers',
    SPORTS_EQUIPMENT: 'Sports Equipment',
  };
  if (special[value]) return special[value];
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export interface Account {
  id: string;
  email: string;
  displayName: string;
  telegramUsername: string;
}

export interface FoundReport {
  id: string;
  itemName: string;
  category: Category;
  colour: Colour;
  brand: string | null; // null means "Unknown"
  dateFound: string;
  locationName: string;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  status: 'OPEN' | 'CLOSED';
  finderDisplayName?: string;
  privateDescription?: string | null; // only present for the owner
}

export interface LostReport {
  id: string;
  itemName: string;
  category: Category;
  colour: Colour;
  brand: string | null;
  dateLost: string;
  locationName: string;
  latitude: number;
  longitude: number;
  notificationThreshold: number;
  photoUrl: string | null;
  privateDescription: string | null;
  status: 'ACTIVE' | 'RESOLVED';
}

export interface MatchEntry {
  matchScore: number;
  foundReport: FoundReport;
}

export interface NotificationItem {
  id: string;
  type: 'MATCH_FOUND' | 'CLAIM_SUBMITTED' | 'CLAIM_APPROVED' | 'CLAIM_REJECTED';
  createdAt: string;
  read: boolean;
  matchScore: number | null;
  foundReportId: string | null;
  lostReportId: string | null;
  claimId: string | null;
  itemName: string | null;
}

/** A person shown on a claim. telegramUsername appears only after approval. */
export interface ClaimParty {
  displayName: string;
  telegramUsername?: string;
}

export interface Claim {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  decidedAt: string | null;
  lostReport: {
    id: string;
    itemName: string;
    category: Category;
    colour: Colour;
    brand: string | null;
    dateLost: string;
    locationName: string;
    photoUrl: string | null;
    privateDescription?: string | null; // finder only, during review
  };
  foundReport: {
    id: string;
    itemName: string;
    category: Category;
    colour: Colour;
    brand: string | null;
    dateFound: string;
    locationName: string;
    photoUrl: string | null;
    privateDescription?: string | null; // finder only, during review
  };
  claimant: ClaimParty;
  finder: ClaimParty;
}

export interface PlaceResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}
