/**
 * Fungsi murni MCDM (Multi-Criteria Decision Making) yang dipakai modul SPK.
 *
 * Semua fungsi di sini tidak menyentuh database dan tidak memutasi input, agar
 * bisa dipakai ulang untuk perhitungan ranking utama, analisis sensitivitas
 * bobot, maupun pembandingan metode (TOPSIS vs SAW vs WP).
 */

export type McdmCriterionType = 'benefit' | 'cost';

export interface McdmCriterion {
  id: string;
  type: McdmCriterionType;
  weight: number;
}

/** Satu baris matriks keputusan: nilai kriteria per alternatif. */
export type DecisionRow = Record<string, number>;

export interface TopsisOutcome {
  normalized: DecisionRow[];
  weighted: DecisionRow[];
  positiveIdeal: DecisionRow;
  negativeIdeal: DecisionRow;
  positiveDistances: number[];
  negativeDistances: number[];
  scores: number[];
}

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Pembagi normalisasi vektor per kriteria: sqrt(sum(x^2)).
 * Nilai 0 diganti 1 supaya tidak menghasilkan pembagian nol.
 */
export const vectorNormalizationDenominators = (
  rows: DecisionRow[],
  criteria: McdmCriterion[]
): Record<string, number> =>
  Object.fromEntries(
    criteria.map((criterion) => {
      const sumSquares = rows.reduce((sum, row) => {
        const value = toFiniteNumber(row[criterion.id]);
        return sum + value * value;
      }, 0);
      const denominator = Math.sqrt(sumSquares);
      return [criterion.id, denominator > 0 ? denominator : 1];
    })
  );

/**
 * TOPSIS: normalisasi vektor -> pembobotan -> solusi ideal positif/negatif ->
 * jarak Euclidean -> nilai preferensi V = D- / (D+ + D-).
 */
export const runTopsis = (rows: DecisionRow[], criteria: McdmCriterion[]): TopsisOutcome => {
  const denominators = vectorNormalizationDenominators(rows, criteria);

  const normalized = rows.map((row) =>
    Object.fromEntries(
      criteria.map((criterion) => [criterion.id, toFiniteNumber(row[criterion.id]) / denominators[criterion.id]])
    )
  );

  const weighted = normalized.map((row) =>
    Object.fromEntries(
      criteria.map((criterion) => {
        const value = toFiniteNumber(row[criterion.id]) * toFiniteNumber(criterion.weight);
        return [criterion.id, Number.isFinite(value) ? value : 0];
      })
    )
  );

  const positiveIdeal: DecisionRow = {};
  const negativeIdeal: DecisionRow = {};
  criteria.forEach((criterion) => {
    const values = weighted.map((row) => toFiniteNumber(row[criterion.id]));
    if (values.length === 0) {
      positiveIdeal[criterion.id] = 0;
      negativeIdeal[criterion.id] = 0;
      return;
    }
    positiveIdeal[criterion.id] = criterion.type === 'benefit' ? Math.max(...values) : Math.min(...values);
    negativeIdeal[criterion.id] = criterion.type === 'benefit' ? Math.min(...values) : Math.max(...values);
  });

  const distanceTo = (row: DecisionRow, ideal: DecisionRow): number =>
    Math.sqrt(
      criteria.reduce((sum, criterion) => {
        const diff = toFiniteNumber(row[criterion.id]) - toFiniteNumber(ideal[criterion.id]);
        return sum + diff * diff;
      }, 0)
    );

  const positiveDistances = weighted.map((row) => distanceTo(row, positiveIdeal));
  const negativeDistances = weighted.map((row) => distanceTo(row, negativeIdeal));
  const scores = positiveDistances.map((positive, index) => {
    const denominator = positive + negativeDistances[index];
    return denominator === 0 ? 0 : negativeDistances[index] / denominator;
  });

  return { normalized, weighted, positiveIdeal, negativeIdeal, positiveDistances, negativeDistances, scores };
};

/**
 * SAW (Simple Additive Weighting) dengan normalisasi max/min:
 * benefit r = x / max(x), cost r = min(x) / x, lalu V = sum(w * r).
 */
export const runSaw = (rows: DecisionRow[], criteria: McdmCriterion[]): number[] => {
  if (rows.length === 0) return [];

  const references = Object.fromEntries(
    criteria.map((criterion) => {
      const values = rows.map((row) => toFiniteNumber(row[criterion.id]));
      return [criterion.id, { max: Math.max(...values), min: Math.min(...values) }];
    })
  );

  return rows.map((row) =>
    criteria.reduce((sum, criterion) => {
      const value = toFiniteNumber(row[criterion.id]);
      const { max, min } = references[criterion.id];
      let normalized: number;
      if (criterion.type === 'benefit') {
        normalized = max > 0 ? value / max : 0;
      } else {
        normalized = value > 0 ? min / value : 0;
      }
      const contribution = normalized * toFiniteNumber(criterion.weight);
      return sum + (Number.isFinite(contribution) ? contribution : 0);
    }, 0)
  );
};

/**
 * WP (Weighted Product): S_i = prod(x_ij ^ w_j) dengan pangkat negatif untuk
 * kriteria cost, lalu V_i = S_i / sum(S).
 *
 * Nilai <= 0 digeser ke epsilon kecil karena WP tidak terdefinisi pada nol.
 */
export const runWp = (rows: DecisionRow[], criteria: McdmCriterion[]): number[] => {
  if (rows.length === 0) return [];

  const epsilon = 1e-9;
  const vectorS = rows.map((row) =>
    criteria.reduce((product, criterion) => {
      const rawValue = toFiniteNumber(row[criterion.id]);
      const value = rawValue > 0 ? rawValue : epsilon;
      const weight = toFiniteNumber(criterion.weight);
      const exponent = criterion.type === 'cost' ? -weight : weight;
      const factor = Math.pow(value, exponent);
      return product * (Number.isFinite(factor) ? factor : 1);
    }, 1)
  );

  const total = vectorS.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return vectorS.map(() => 0);
  return vectorS.map((value) => value / total);
};

/**
 * Peringkat 1..n dari skor (skor tertinggi = peringkat 1).
 * Nilai kembar mendapat rata-rata peringkat agar korelasi tetap valid.
 */
export const rankFromScores = (scores: number[]): number[] => {
  const indexed = scores.map((score, index) => ({ score: toFiniteNumber(score), index }));
  const sorted = [...indexed].sort((left, right) => right.score - left.score);

  const ranks = new Array<number>(scores.length).fill(0);
  let position = 0;
  while (position < sorted.length) {
    let end = position;
    while (end + 1 < sorted.length && sorted[end + 1].score === sorted[position].score) {
      end += 1;
    }
    // Rata-rata peringkat untuk seluruh anggota kelompok nilai kembar.
    const averageRank = (position + end + 2) / 2;
    for (let i = position; i <= end; i += 1) {
      ranks[sorted[i].index] = averageRank;
    }
    position = end + 1;
  }
  return ranks;
};

const pearson = (left: number[], right: number[]): number => {
  const n = left.length;
  if (n === 0 || right.length !== n) return 0;
  const meanLeft = left.reduce((sum, value) => sum + value, 0) / n;
  const meanRight = right.reduce((sum, value) => sum + value, 0) / n;

  let covariance = 0;
  let varianceLeft = 0;
  let varianceRight = 0;
  for (let i = 0; i < n; i += 1) {
    const deltaLeft = left[i] - meanLeft;
    const deltaRight = right[i] - meanRight;
    covariance += deltaLeft * deltaRight;
    varianceLeft += deltaLeft * deltaLeft;
    varianceRight += deltaRight * deltaRight;
  }

  const denominator = Math.sqrt(varianceLeft * varianceRight);
  if (denominator === 0) {
    // Tidak ada variasi di salah satu sisi (mis. semua alternatif seri):
    // dianggap identik hanya bila kedua sisi memang sama-sama konstan.
    return varianceLeft === 0 && varianceRight === 0 ? 1 : 0;
  }
  return covariance / denominator;
};

/**
 * Koefisien korelasi peringkat Spearman (rho) dari dua daftar skor.
 * Dihitung sebagai korelasi Pearson atas peringkat, sehingga tetap benar
 * saat ada nilai kembar.
 */
export const spearmanRho = (scoresA: number[], scoresB: number[]): number => {
  if (scoresA.length !== scoresB.length || scoresA.length === 0) return 0;
  if (scoresA.length === 1) return 1;
  return pearson(rankFromScores(scoresA), rankFromScores(scoresB));
};

/**
 * Koefisien Kendall tau-b (tahan terhadap nilai kembar) dari dua daftar skor.
 */
export const kendallTau = (scoresA: number[], scoresB: number[]): number => {
  const n = scoresA.length;
  if (n !== scoresB.length || n === 0) return 0;
  if (n === 1) return 1;

  let concordant = 0;
  let discordant = 0;
  let tiedA = 0;
  let tiedB = 0;

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const deltaA = Math.sign(toFiniteNumber(scoresA[i]) - toFiniteNumber(scoresA[j]));
      const deltaB = Math.sign(toFiniteNumber(scoresB[i]) - toFiniteNumber(scoresB[j]));
      if (deltaA === 0 && deltaB === 0) continue;
      if (deltaA === 0) {
        tiedA += 1;
        continue;
      }
      if (deltaB === 0) {
        tiedB += 1;
        continue;
      }
      if (deltaA === deltaB) concordant += 1;
      else discordant += 1;
    }
  }

  const denominator = Math.sqrt((concordant + discordant + tiedA) * (concordant + discordant + tiedB));
  if (denominator === 0) return 1;
  return (concordant - discordant) / denominator;
};

/**
 * Proporsi irisan anggota top-K antara dua daftar skor (0..1).
 * Dipakai untuk mengukur stabilitas prioritas teratas, bukan sekadar korelasi
 * global — pengguna SPK hanya menindaklanjuti peringkat teratas.
 */
export const topKOverlapRatio = (scoresA: number[], scoresB: number[], k: number): number => {
  const size = Math.min(k, scoresA.length, scoresB.length);
  if (size <= 0) return 1;

  const topIndices = (scores: number[]): Set<number> => {
    const sorted = scores
      .map((score, index) => ({ score: toFiniteNumber(score), index }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, size);
    return new Set(sorted.map((entry) => entry.index));
  };

  const setA = topIndices(scoresA);
  const setB = topIndices(scoresB);
  let intersection = 0;
  setA.forEach((index) => {
    if (setB.has(index)) intersection += 1;
  });
  return intersection / size;
};
