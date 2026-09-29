/**
 * Lab 4, section 3.2.2 - white box testing using BASIS PATH testing on the two
 * methods with the most branching:
 *
 *   1. calculateMatchScore()   cyclomatic complexity 4 -> 4 independent paths
 *   2. colourSimilarity()      cyclomatic complexity 3 -> 3 independent paths
 *
 * Each test below is labelled with the path through the code that it covers.
 */
import { describe, expect, it } from 'vitest';
import { calculateMatchScore, colourSimilarity, MatchInput } from '../src/domain/matching';

const AT_NTU = { latitude: 1.34639, longitude: 103.68194 };

function report(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    category: 'BAGS',
    colour: 'BLACK',
    brand: 'Nike',
    date: new Date('2026-09-01T00:00:00.000Z'),
    ...AT_NTU,
    ...overrides,
  };
}

/**
 * calculateMatchScore() control flow graph:
 *
 *   1  start
 *   2  if (daysBetween < 0)            -> return 0            [path A]
 *   3  if (categories differ)          -> return 0            [path B]
 *   4  compute colour / date / location
 *   5  if (brandIsKnown)               -> weighted / 100      [path C]
 *   6  else                            -> weighted / 95       [path D]
 *   7  round, clamp, return
 *
 * Decisions: 3 -> cyclomatic complexity = 3 + 1 = 4 -> 4 basis paths.
 */
describe('basis paths through calculateMatchScore()', () => {
  it('Path A: 1-2-return (found earlier than lost)', () => {
    const lost = report({ date: new Date('2026-09-10T00:00:00.000Z') });
    const found = report({ date: new Date('2026-09-01T00:00:00.000Z') });
    expect(calculateMatchScore(lost, found)).toBe(0);
  });

  it('Path B: 1-2-3-return (date fine, categories differ)', () => {
    const lost = report({ category: 'ELECTRONICS' });
    const found = report({ category: 'UMBRELLAS' });
    expect(calculateMatchScore(lost, found)).toBe(0);
  });

  it('Path C: 1-2-3-4-5-7 (both checks pass, both brands known)', () => {
    const lost = report({ brand: 'Nike' });
    const found = report({ brand: 'Adidas' });
    // Colour, date and location are all perfect; only brand differs.
    // (25*100 + 5*0 + 30*100 + 40*100) / 100 = 95
    expect(calculateMatchScore(lost, found)).toBe(95);
  });

  it('Path D: 1-2-3-4-6-7 (both checks pass, a brand is unknown)', () => {
    const lost = report({ brand: null });
    const found = report({ brand: 'Adidas' });
    // Brand is dropped entirely: (25*100 + 30*100 + 40*100) / 95 = 100
    expect(calculateMatchScore(lost, found)).toBe(100);
  });
});

/**
 * colourSimilarity() control flow graph:
 *
 *   1  start
 *   2  if (lost === found)                    -> return 100   [path A]
 *   3  if (pair is in the similar list)       -> return 50    [path B]
 *   4  return 0                                               [path C]
 *
 * Decisions: 2 -> cyclomatic complexity = 2 + 1 = 3 -> 3 basis paths.
 */
describe('basis paths through colourSimilarity()', () => {
  it('Path A: 1-2-return 100 (identical colours)', () => {
    expect(colourSimilarity('RED', 'RED')).toBe(100);
  });

  it('Path B: 1-2-3-return 50 (a listed similar pair)', () => {
    expect(colourSimilarity('RED', 'MAROON')).toBe(50);
  });

  it('Path C: 1-2-3-4-return 0 (unrelated colours)', () => {
    expect(colourSimilarity('RED', 'GREEN')).toBe(0);
  });
});

/**
 * All nine similar-colour pairs from SRS 4.4.4, checked in both directions.
 * This is data coverage rather than path coverage, but it protects the table
 * itself from typos.
 */
describe('the nine similar colour pairs are all present and symmetric', () => {
  const pairs: Array<[string, string]> = [
    ['BLACK', 'GREY'],
    ['WHITE', 'GREY'],
    ['RED', 'MAROON'],
    ['RED', 'PINK'],
    ['RED', 'ORANGE'],
    ['ORANGE', 'YELLOW'],
    ['BLUE', 'NAVY'],
    ['BLUE', 'PURPLE'],
    ['PINK', 'PURPLE'],
  ];

  it.each(pairs)('%s and %s score 50 in both directions', (a, b) => {
    expect(colourSimilarity(a, b)).toBe(50);
    expect(colourSimilarity(b, a)).toBe(50);
  });

  it('a pair that is NOT in the list scores 0 (e.g. Red and Purple)', () => {
    expect(colourSimilarity('RED', 'PURPLE')).toBe(0);
  });
});
