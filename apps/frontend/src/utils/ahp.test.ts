import { describe, expect, it } from 'vitest';
import {
  buildDefaultPairwiseValues,
  buildPairwiseKey,
  buildPairwiseMatrixFromValues,
  buildPairwiseValuesFromMatrix,
  closestSaatyValue,
  computePairwiseConsistencyHints,
  rescaleWeightsToSliderRange,
} from './ahp';

const CRITERIA_IDS = ['condition', 'age', 'maintenanceDue'];

describe('buildDefaultPairwiseValues', () => {
  it('initializes every pair to 1', () => {
    const values = buildDefaultPairwiseValues(CRITERIA_IDS);
    expect(Object.keys(values)).toHaveLength(3); // 3 choose 2
    expect(Object.values(values).every((value) => value === 1)).toBe(true);
  });
});

describe('buildPairwiseMatrixFromValues / buildPairwiseValuesFromMatrix', () => {
  it('builds a reciprocal matrix from pairwise values', () => {
    const values = {
      [buildPairwiseKey('condition', 'age')]: 3,
      [buildPairwiseKey('condition', 'maintenanceDue')]: 5,
      [buildPairwiseKey('age', 'maintenanceDue')]: 2,
    };
    const matrix = buildPairwiseMatrixFromValues(values, CRITERIA_IDS);

    expect(matrix[0][1]).toBe(3);
    expect(matrix[1][0]).toBeCloseTo(1 / 3, 10);
    expect(matrix[0][2]).toBe(5);
    expect(matrix[2][0]).toBeCloseTo(1 / 5, 10);
    expect(matrix.every((row, i) => row[i] === 1)).toBe(true);
  });

  it('round-trips through buildPairwiseValuesFromMatrix', () => {
    const values = {
      [buildPairwiseKey('condition', 'age')]: 7,
      [buildPairwiseKey('condition', 'maintenanceDue')]: 1 / 3,
      [buildPairwiseKey('age', 'maintenanceDue')]: 1,
    };
    const matrix = buildPairwiseMatrixFromValues(values, CRITERIA_IDS);
    const restored = buildPairwiseValuesFromMatrix(matrix, CRITERIA_IDS);

    Object.entries(values).forEach(([key, value]) => {
      expect(restored[key]).toBeCloseTo(value, 10);
    });
  });

  it('falls back to 1 for missing or invalid entries', () => {
    const matrix = buildPairwiseMatrixFromValues({}, CRITERIA_IDS);
    expect(matrix.every((row) => row.every((value) => value === 1))).toBe(true);

    const restored = buildPairwiseValuesFromMatrix([[1, 1], [1, 1]], ['a', 'b']);
    expect(restored[buildPairwiseKey('a', 'b')]).toBe(1);
  });
});

describe('closestSaatyValue', () => {
  it('snaps arbitrary values to the nearest Saaty scale entry', () => {
    expect(closestSaatyValue(1)).toBe(1);
    expect(closestSaatyValue(4)).toBe(5);
    expect(closestSaatyValue(6)).toBe(7);
    expect(closestSaatyValue(0.3)).toBeCloseTo(1 / 3, 10);
    expect(closestSaatyValue(9)).toBe(9);
  });
});

describe('rescaleWeightsToSliderRange', () => {
  it('scales the largest weight to 40 and preserves ratios', () => {
    const result = rescaleWeightsToSliderRange({ condition: 0.5, age: 0.25, maintenanceDue: 0.25 }, {});
    expect(result.condition).toBe(40);
    expect(result.age).toBe(20);
    expect(result.maintenanceDue).toBe(20);
  });

  it('clamps into [1, 40] and falls back to base when nothing is positive', () => {
    const base = { condition: 5 };
    expect(rescaleWeightsToSliderRange({ condition: 0, age: -1 }, base)).toEqual(base);

    const result = rescaleWeightsToSliderRange({ condition: 0.001, age: 1 }, {});
    expect(result.condition).toBeGreaterThanOrEqual(1);
    expect(result.age).toBeLessThanOrEqual(40);
  });
});

describe('computePairwiseConsistencyHints', () => {
  it('scores every pair low for a matrix derived from a single consistent priority vector', () => {
    // Priority vector [4, 2, 1] -> pairwise ratios are exactly consistent.
    const consistentMatrix = [
      [1, 2, 4],
      [1 / 2, 1, 2],
      [1 / 4, 1 / 2, 1],
    ];
    const hints = computePairwiseConsistencyHints(consistentMatrix, CRITERIA_IDS);
    expect(hints).toHaveLength(3);
    hints.forEach((hint) => {
      expect(hint.score).toBeLessThan(1e-6);
      expect(hint.isHighContributor).toBe(false);
    });
  });

  it('flags the deliberately contradictory pair as the highest contributor', () => {
    // condition vs age and age vs maintenanceDue imply condition should dominate
    // maintenanceDue, but the matrix asserts the opposite for that pair.
    const inconsistentMatrix = [
      [1, 3, 1 / 9],
      [1 / 3, 1, 3],
      [9, 1 / 3, 1],
    ];
    const hints = computePairwiseConsistencyHints(inconsistentMatrix, CRITERIA_IDS);
    const worst = [...hints].sort((a, b) => b.score - a.score)[0];
    expect(worst.rowId).toBe('condition');
    expect(worst.colId).toBe('maintenanceDue');
    expect(worst.isHighContributor).toBe(true);
  });

  it('returns an empty array for an empty criteria list', () => {
    expect(computePairwiseConsistencyHints([], [])).toEqual([]);
  });
});
