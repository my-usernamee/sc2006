/**
 * Input validation, using zod. Every route validates its body here before the
 * service runs, which is how REQ-21 and REQ-36 ("prevent submission when a
 * required field is missing") are enforced.
 *
 * Note: form data arrives as strings because reports are sent as multipart
 * (they carry a photo), so numbers use z.coerce.number().
 */
import { z } from 'zod';

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

// --- Accounts ---------------------------------------------------------------

export const registerSchema = z.object({
  // REQ-2: only NTU student addresses may register.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address.')
    .refine((e) => e.endsWith('@e.ntu.edu.sg'), 'You must register with an @e.ntu.edu.sg email.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  displayName: z.string().trim().min(1, 'Display name is required.').max(60), // REQ-3
  telegramUsername: z.string().trim().min(1, 'Telegram username is required.').max(60), // REQ-3
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

// REQ-7: only these two fields may be edited.
export const updateAccountSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  telegramUsername: z.string().trim().min(1).max(60),
});

// --- Reports ----------------------------------------------------------------

/** A date-only string such as "2026-09-08", not in the future. */
const reportDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must look like YYYY-MM-DD.')
  .transform((s) => new Date(s + 'T00:00:00.000Z'))
  .refine((d) => !Number.isNaN(d.getTime()), 'That is not a real date.')
  .refine((d) => d.getTime() <= Date.now(), 'The date cannot be in the future.');

/**
 * Brand is required, but instead of typing one the user may tick
 * "brand unknown" (REQ-16 / REQ-29). An unknown brand is stored as null.
 * These two raw form fields are turned into a single `brand` value below.
 */
const rawBrandFields = {
  brand: z.string().trim().max(60).optional(),
  brandUnknown: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true'),
};

const locationFields = {
  locationName: z.string().trim().min(1, 'Select a location on the map.'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
};

/** Shared check: you must either give a brand or tick "brand unknown". */
function checkBrand(
  data: { brand?: string; brandUnknown: boolean },
  ctx: z.RefinementCtx,
) {
  if (!data.brandUnknown && !data.brand) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['brand'],
      message: 'Enter a brand, or tick "Brand unknown".',
    });
  }
}

/** Replaces the two raw brand fields with one value: the brand, or null. */
function normaliseBrand<T extends { brand?: string; brandUnknown: boolean }>(data: T) {
  const { brandUnknown, ...rest } = data;
  return { ...rest, brand: brandUnknown ? null : (data.brand as string) };
}

// REQ-10: item name, category, colour, brand, date lost, location, threshold.
export const lostReportSchema = z
  .object({
    itemName: z.string().trim().min(1, 'Item name is required.').max(100),
    category: z.enum(CATEGORIES),
    colour: z.enum(COLOURS),
    dateLost: reportDate,
    ...rawBrandFields,
    ...locationFields,
    // REQ-20: threshold from 0 to 100 inclusive.
    notificationThreshold: z.coerce.number().int().min(0).max(100),
    // REQ-18: optional private description.
    privateDescription: z.string().trim().max(500).optional(),
  })
  .superRefine(checkBrand)
  .transform(normaliseBrand);

// REQ-27: photo, item name, category, colour, brand, date found, location.
// (The photo itself is handled by multer, not by zod.)
export const foundReportSchema = z
  .object({
    itemName: z.string().trim().min(1, 'Item name is required.').max(100),
    category: z.enum(CATEGORIES),
    colour: z.enum(COLOURS),
    dateFound: reportDate,
    ...rawBrandFields,
    ...locationFields,
    // REQ-34: optional private description.
    privateDescription: z.string().trim().max(500).optional(),
  })
  .superRefine(checkBrand)
  .transform(normaliseBrand);

export type LostReportInput = z.infer<typeof lostReportSchema>;
export type FoundReportInput = z.infer<typeof foundReportSchema>;

// --- Claims -----------------------------------------------------------------

export const createClaimSchema = z.object({
  foundReportId: z.string().min(1),
  lostReportId: z.string().min(1), // REQ-61
});

// --- Browsing ---------------------------------------------------------------

export const browseQuerySchema = z.object({
  q: z.string().trim().optional(), // REQ-57: search by item name
  category: z.enum(CATEGORIES).optional(), // REQ-58
  colour: z.enum(COLOURS).optional(), // REQ-58
  page: z.coerce.number().int().min(1).default(1),
});
