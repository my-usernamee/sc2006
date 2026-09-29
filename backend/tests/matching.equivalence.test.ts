/**
 * Lab 4, section 3.2.1 - black box testing of the matching control logic using
 * EQUIVALENCE CLASS and BOUNDARY VALUE techniques.
 *
 * The input domain of calculateMatchScore is divided into classes, and one
 * representative value is tested from each, plus the values on the boundaries.
 */
import { describe, expect, it } from 'vitest';
import { calculateMatchScore, MatchInput } from '../src/domain/matching';

const NTU_HIVE = { latitude: 1.34639, longitude: 103.68194 };

/** A helper so each test only states what it is actually varying. */
function report(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    category: 'BAGS',
    colour: 'BLACK',
    brand: 'Nike',
    date: new Date('2026-09-01T00:00:00.000Z'),
    ...NTU_HIVE,
    ...overrides,
  };
}

describe('rejection checks (SRS 4.4.4)', () => {
  // Equivalence classes for the date check: found before lost / same day / after
  it('scores 0 when the item was found BEFORE it was lost (REQ-47)', () => {
    const lost = report({ date: new Date('2026-09-10T00:00:00.000Z') });
    const found = report({ date: new Date('2026-09-09T00:00:00.000Z') });
    expect(calculateMatchScore(lost, found)).toBe(0);
  });

  it('boundary: found on the SAME day as lost is allowed', () => {
    const lost = report({ date: new Date('2026-09-10T00:00:00.000Z') });
    const found = report({ date: new Date('2026-09-10T00:00:00.000Z') });
    expect(calculateMatchScore(lost, found)).toBe(100);
  });

  it('scores 0 when the categories are different', () => {
    expect(calculateMatchScore(report({ category: 'BAGS' }), report({ category: 'KEYS' }))).toBe(0);
  });
});

describe('colour similarity classes', () => {
  // Three equivalence classes: identical / listed similar pair / unrelated
  it('identical colours give the maximum score', () => {
    expect(calculateMatchScore(report({ colour: 'BLUE' }), report({ colour: 'BLUE' }))).toBe(100);
  });

  it('a listed similar pair (Blue-Navy) scores half the colour weight', () => {
    // colour contributes 25 * 50 / 100 = 12.5 instead of 25 -> 100 - 12.5 = 87.5 -> 88
    expect(calculateMatchScore(report({ colour: 'BLUE' }), report({ colour: 'NAVY' }))).toBe(88);
  });

  it('the similar pair list works in either order (Navy-Blue)', () => {
    expect(calculateMatchScore(report({ colour: 'NAVY' }), report({ colour: 'BLUE' }))).toBe(88);
  });

  it('an unrelated colour pair scores nothing for colour', () => {
    // 100 - 25 = 75
    expect(calculateMatchScore(report({ colour: 'GREEN' }), report({ colour: 'BROWN' }))).toBe(75);
  });
});

describe('brand handling (REQ-48)', () => {
  it('matching brands are compared case-insensitively', () => {
    expect(calculateMatchScore(report({ brand: 'NIKE' }), report({ brand: 'nike' }))).toBe(100);
  });

  it('different brands lose the 5% brand weight', () => {
    expect(calculateMatchScore(report({ brand: 'Nike' }), report({ brand: 'Adidas' }))).toBe(95);
  });

  it('an unknown brand on either side removes brand and normalises by 95', () => {
    // A perfect match on everything else still scores 100, not 95.
    expect(calculateMatchScore(report({ brand: null }), report({ brand: 'Nike' }))).toBe(100);
    expect(calculateMatchScore(report({ brand: 'Nike' }), report({ brand: null }))).toBe(100);
    expect(calculateMatchScore(report({ brand: null }), report({ brand: null }))).toBe(100);
  });
});

describe('date similarity boundaries', () => {
  const lost = report({ date: new Date('2026-09-01T00:00:00.000Z') });

  it('0 days apart scores the full date weight', () => {
    expect(calculateMatchScore(lost, report({ date: new Date('2026-09-01T00:00:00.000Z') }))).toBe(100);
  });

  it('7 days apart halves the date score', () => {
    // S_date = 50, so total = (25*100 + 5*100 + 30*50 + 40*100) / 100 = 85
    expect(calculateMatchScore(lost, report({ date: new Date('2026-09-08T00:00:00.000Z') }))).toBe(85);
  });

  it('14 days apart quarters the date score', () => {
    // S_date = 25, total = (2500 + 500 + 750 + 4000) / 100 = 77.5 -> 78
    expect(calculateMatchScore(lost, report({ date: new Date('2026-09-15T00:00:00.000Z') }))).toBe(78);
  });
});

describe('location similarity boundaries', () => {
  const lost = report();

  it('the same spot scores the full location weight', () => {
    expect(calculateMatchScore(lost, report())).toBe(100);
  });

  it('roughly 0.5 km away halves the location score', () => {
    // 0.0045 degrees of latitude is about 0.5 km.
    const found = report({ latitude: NTU_HIVE.latitude + 0.0045 });
    const score = calculateMatchScore(lost, found);
    // S_location ~ 50, so total ~ (2500 + 500 + 3000 + 2000) / 100 = 80
    expect(score).toBeGreaterThanOrEqual(79);
    expect(score).toBeLessThanOrEqual(81);
  });

  it('a long distance away leaves almost no location score', () => {
    // Changi Airport, about 25 km from NTU.
    const found = report({ latitude: 1.3644, longitude: 103.9915 });
    expect(calculateMatchScore(lost, found)).toBe(61); // 25 + 5 + 30 + ~0.65
  });
});

describe('output boundaries (REQ-50)', () => {
  it('never returns a value below 0 or above 100', () => {
    const worst = calculateMatchScore(
      report({ colour: 'GREEN', brand: 'A', latitude: 1.3644, longitude: 103.9915 }),
      report({ colour: 'BROWN', brand: 'B', date: new Date('2027-09-01T00:00:00.000Z') }),
    );
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThanOrEqual(100);
  });

  it('always returns a whole number', () => {
    const score = calculateMatchScore(report({ colour: 'BLUE' }), report({ colour: 'NAVY' }));
    expect(Number.isInteger(score)).toBe(true);
  });
});
