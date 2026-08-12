import { describe, expect, it } from 'vitest';
import {
  kendallTau,
  McdmCriterion,
  rankFromScores,
  runSaw,
  runTopsis,
  runWp,
  spearmanRho,
  topKOverlapRatio,
  vectorNormalizationDenominators,
} from './mcdm';

const criteria: McdmCriterion[] = [
  { id: 'benefit', type: 'benefit', weight: 0.6 },
  { id: 'cost', type: 'cost', weight: 0.4 },
];

const rows = [
  { benefit: 5, cost: 1 },
  { benefit: 3, cost: 3 },
  { benefit: 1, cost: 5 },
];

describe('vectorNormalizationDenominators', () => {
  it('returns sqrt of the sum of squares per criterion', () => {
    const denominators = vectorNormalizationDenominators(rows, criteria);
    expect(denominators.benefit).toBeCloseTo(Math.sqrt(25 + 9 + 1), 10);
    expect(denominators.cost).toBeCloseTo(Math.sqrt(1 + 9 + 25), 10);
  });

  it('falls back to 1 when a criterion has only zero values', () => {
    const denominators = vectorNormalizationDenominators([{ benefit: 0, cost: 0 }], criteria);
    expect(denominators.benefit).toBe(1);
  });
});

describe('runTopsis', () => {
  it('scores the alternative that is best on benefit and cheapest on cost highest', () => {
    const outcome = runTopsis(rows, criteria);
    expect(outcome.scores[0]).toBeGreaterThan(outcome.scores[1]);
    expect(outcome.scores[1]).toBeGreaterThan(outcome.scores[2]);
    // Alternatif terbaik berimpit dengan solusi ideal positif.
    expect(outcome.scores[0]).toBeCloseTo(1, 10);
    expect(outcome.scores[2]).toBeCloseTo(0, 10);
  });

  it('takes the minimum weighted value as the positive ideal for cost criteria', () => {
    const outcome = runTopsis(rows, criteria);
    const costValues = outcome.weighted.map((row) => row.cost);
    expect(outcome.positiveIdeal.cost).toBeCloseTo(Math.min(...costValues), 10);
    expect(outcome.negativeIdeal.cost).toBeCloseTo(Math.max(...costValues), 10);
  });

  it('returns a zero preference score when every alternative is identical', () => {
    const identical = [{ benefit: 2, cost: 2 }, { benefit: 2, cost: 2 }];
    expect(runTopsis(identical, criteria).scores).toEqual([0, 0]);
  });

  it('handles an empty decision matrix without throwing', () => {
    const outcome = runTopsis([], criteria);
    expect(outcome.scores).toEqual([]);
    expect(outcome.positiveIdeal.benefit).toBe(0);
  });
});

describe('runSaw', () => {
  it('matches a hand-computed max/min normalization result', () => {
    const scores = runSaw(rows, criteria);
    // Alternatif 1: benefit 5/5 = 1, cost min/x = 1/1 = 1 -> 0.6 + 0.4 = 1
    expect(scores[0]).toBeCloseTo(1, 10);
    // Alternatif 2: 3/5 = 0.6, 1/3 -> 0.6*0.6 + 0.4/3
    expect(scores[1]).toBeCloseTo(0.6 * 0.6 + 0.4 * (1 / 3), 10);
    // Alternatif 3: 1/5 = 0.2, 1/5 = 0.2 -> 0.6*0.2 + 0.4*0.2
    expect(scores[2]).toBeCloseTo(0.2 * 0.6 + 0.2 * 0.4, 10);
  });

  it('returns an empty array for an empty matrix', () => {
    expect(runSaw([], criteria)).toEqual([]);
  });
});

describe('runWp', () => {
  it('produces normalized vector-S values that sum to 1', () => {
    const scores = runWp(rows, criteria);
    expect(scores.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(scores[2]);
  });

  it('matches the hand-computed S vector proportions', () => {
    const scores = runWp(rows, criteria);
    const s = rows.map((row) => Math.pow(row.benefit, 0.6) * Math.pow(row.cost, -0.4));
    const total = s.reduce((sum, value) => sum + value, 0);
    scores.forEach((score, index) => {
      expect(score).toBeCloseTo(s[index] / total, 10);
    });
  });
});

describe('rankFromScores', () => {
  it('assigns rank 1 to the highest score', () => {
    expect(rankFromScores([0.1, 0.9, 0.5])).toEqual([3, 1, 2]);
  });

  it('averages ranks across tied scores', () => {
    expect(rankFromScores([1, 1, 0])).toEqual([1.5, 1.5, 3]);
  });
});

describe('spearmanRho', () => {
  it('returns 1 for identical orderings and -1 for fully reversed ones', () => {
    expect(spearmanRho([3, 2, 1], [30, 20, 10])).toBeCloseTo(1, 10);
    expect(spearmanRho([3, 2, 1], [1, 2, 3])).toBeCloseTo(-1, 10);
  });

  it('handles ties without producing NaN', () => {
    const rho = spearmanRho([1, 1, 2], [1, 2, 3]);
    expect(Number.isFinite(rho)).toBe(true);
  });

  it('returns 0 for mismatched or empty inputs', () => {
    expect(spearmanRho([1, 2], [1])).toBe(0);
    expect(spearmanRho([], [])).toBe(0);
  });
});

describe('kendallTau', () => {
  it('returns 1 for identical orderings and -1 for reversed ones', () => {
    expect(kendallTau([3, 2, 1], [9, 5, 1])).toBeCloseTo(1, 10);
    expect(kendallTau([3, 2, 1], [1, 5, 9])).toBeCloseTo(-1, 10);
  });

  it('stays within [-1, 1] when there are ties', () => {
    const tau = kendallTau([1, 1, 2, 3], [1, 2, 2, 3]);
    expect(tau).toBeLessThanOrEqual(1);
    expect(tau).toBeGreaterThanOrEqual(-1);
  });
});

describe('topKOverlapRatio', () => {
  it('reports full overlap when the same alternatives occupy the top K', () => {
    expect(topKOverlapRatio([5, 4, 1, 0], [9, 8, 2, 1], 2)).toBe(1);
  });

  it('reports partial overlap when one member of the top K differs', () => {
    expect(topKOverlapRatio([5, 4, 1, 0], [5, 0, 9, 1], 2)).toBe(0.5);
  });

  it('clamps K to the available number of alternatives', () => {
    expect(topKOverlapRatio([1, 2], [2, 1], 10)).toBe(1);
  });
});
