import {
  registerSchema, updateAccountSchema, lostReportSchema, foundReportSchema,
  browseQuerySchema, createClaimSchema, CATEGORIES, COLOURS,
} from '../src/validation/schemas';
import { input } from './helpers';

const registration = {
  email: 'owner@e.ntu.edu.sg', password: 'password123', displayName: 'Owner', telegramUsername: 'owner_handle',
};

describe('account validation REQ-1 to REQ-3 and REQ-7', () => {
  it('accepts a valid registration and normalises the email', () => {
    expect(registerSchema.parse({ ...registration, email: ' OWNER@e.ntu.edu.sg ' }).email).toBe(registration.email);
  });
  it.each(['a@gmail.com', 'a@ntu.edu.sg', 'not-an-email'])('rejects unsupported email %s', email => {
    expect(registerSchema.safeParse({ ...registration, email }).success).toBe(false);
  });
  it.each([[7, false], [8, true], [9, true]])('checks password length %i', (length, valid) => {
    expect(registerSchema.safeParse({ ...registration, password: 'a'.repeat(length as number) }).success).toBe(valid);
  });
  it.each(['displayName', 'telegramUsername'])('rejects missing %s', field => {
    expect(registerSchema.safeParse({ ...registration, [field]: '' }).success).toBe(false);
  });
  it('account update accepts only display name and Telegram', () => {
    expect(updateAccountSchema.parse({ displayName: 'New', telegramUsername: 'new_handle', email: 'other@e.ntu.edu.sg' }))
      .toEqual({ displayName: 'New', telegramUsername: 'new_handle' });
  });
});

describe('report validation REQ-10 to REQ-21 and REQ-27 to REQ-36', () => {
  it.each([lostReportSchema, foundReportSchema])('accepts valid report fields', schema => {
    expect(schema.safeParse(input).success).toBe(true);
  });
  it.each(['itemName', 'category', 'colour', 'brand', 'dateLost', 'locationName', 'notificationThreshold'])
    ('rejects a missing lost field %s', field => {
      const value: any = { ...input }; delete value[field];
      expect(lostReportSchema.safeParse(value).success).toBe(false);
    });
  it.each(['itemName', 'category', 'colour', 'brand', 'dateFound', 'locationName'])
    ('rejects a missing found field %s', field => {
      const value: any = { ...input }; delete value[field];
      expect(foundReportSchema.safeParse(value).success).toBe(false);
    });
  it.each(CATEGORIES)('accepts category %s', category => {
    expect(lostReportSchema.safeParse({ ...input, category }).success).toBe(true);
    expect(foundReportSchema.safeParse({ ...input, category }).success).toBe(true);
  });
  it.each(COLOURS)('accepts colour %s', colour => {
    expect(lostReportSchema.safeParse({ ...input, colour }).success).toBe(true);
    expect(foundReportSchema.safeParse({ ...input, colour }).success).toBe(true);
  });
  it.each(['lost', 'found'])('accepts unknown brand and optional private description for %s', kind => {
    const schema = kind === 'lost' ? lostReportSchema : foundReportSchema;
    const value = schema.parse({ ...input, brand: undefined, brandUnknown: 'true', privateDescription: 'A mark' });
    expect(value.brand).toBeNull();
    expect(value.privateDescription).toBe('A mark');
  });
  it.each([[-1, false], [0, true], [1, true], [99, true], [100, true], [101, false], [50.5, false]])
    ('threshold %s is accepted %s', (notificationThreshold, expected) => {
      expect(lostReportSchema.safeParse({ ...input, notificationThreshold }).success).toBe(expected);
    });
  it.each(['category', 'colour'])('rejects unknown %s', field => {
    expect(lostReportSchema.safeParse({ ...input, [field]: 'INVALID' }).success).toBe(false);
  });
  it.each([['latitude', 91], ['longitude', 181], ['latitude', -91], ['longitude', -181]])
    ('rejects out of range %s %s', (field, value) => {
      expect(lostReportSchema.safeParse({ ...input, [field]: value }).success).toBe(false);
    });
  it.each(['2026-02-30', '2026-13-01', '2026-1-1', 'bad-date'])('rejects invalid date %s', date => {
    expect(lostReportSchema.safeParse({ ...input, dateLost: date }).success).toBe(false);
    expect(foundReportSchema.safeParse({ ...input, dateFound: date }).success).toBe(false);
  });
  it('uses the Singapore calendar date at the UTC day boundary', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-04T16:30:00Z'));
    try {
      expect(lostReportSchema.safeParse({ ...input, dateLost: '2026-11-05' }).success).toBe(true);
      expect(foundReportSchema.safeParse({ ...input, dateFound: '2026-11-05' }).success).toBe(true);
      expect(lostReportSchema.safeParse({ ...input, dateLost: '2026-11-06' }).success).toBe(false);
      expect(foundReportSchema.safeParse({ ...input, dateFound: '2026-11-06' }).success).toBe(false);
    } finally { jest.useRealTimers(); }
  });
});

describe('browse and claim inputs', () => {
  it('accepts search with category and colour filters', () => {
    expect(browseQuerySchema.parse({ q: '  Bag ', category: 'BAGS', colour: 'BLACK' }))
      .toEqual({ q: 'Bag', category: 'BAGS', colour: 'BLACK', page: 1 });
  });
  it('requires both report IDs for a claim', () => {
    expect(createClaimSchema.safeParse({ foundReportId: 'found' }).success).toBe(false);
    expect(createClaimSchema.safeParse({ foundReportId: 'found', lostReportId: 'lost' }).success).toBe(true);
  });
});
