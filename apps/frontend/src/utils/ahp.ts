export const SAATY_SCALE_OPTIONS = [
  { value: 9, label: "9 - Mutlak lebih penting" },
  { value: 7, label: "7 - Sangat lebih penting" },
  { value: 5, label: "5 - Lebih penting" },
  { value: 3, label: "3 - Sedikit lebih penting" },
  { value: 1, label: "1 - Sama penting" },
  { value: 1 / 3, label: "1/3 - Sedikit lebih penting" },
  { value: 1 / 5, label: "1/5 - Lebih penting" },
  { value: 1 / 7, label: "1/7 - Sangat lebih penting" },
  { value: 1 / 9, label: "1/9 - Mutlak lebih penting" },
]

export const closestSaatyValue = (value: number) => {
  return SAATY_SCALE_OPTIONS.reduce((closest, option) => (
    Math.abs(option.value - value) < Math.abs(closest - value) ? option.value : closest
  ), 1)
}

export const buildPairwiseKey = (rowId: string, colId: string) => `${rowId}__${colId}`

export const buildDefaultPairwiseValues = (criteriaIds: string[]): Record<string, number> => {
  const values: Record<string, number> = {}
  for (let i = 0; i < criteriaIds.length; i += 1) {
    for (let j = i + 1; j < criteriaIds.length; j += 1) {
      values[buildPairwiseKey(criteriaIds[i], criteriaIds[j])] = 1
    }
  }
  return values
}

export const buildPairwiseMatrixFromValues = (values: Record<string, number>, criteriaIds: string[]): number[][] => {
  const n = criteriaIds.length
  const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 1))
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const raw = Number(values[buildPairwiseKey(criteriaIds[i], criteriaIds[j])])
      const value = Number.isFinite(raw) && raw > 0 ? raw : 1
      matrix[i][j] = value
      matrix[j][i] = 1 / value
    }
  }
  return matrix
}

// Inverse of buildPairwiseMatrixFromValues — used to restore a matrix saved in
// ranking history back into the editable pairwiseValues map.
export const buildPairwiseValuesFromMatrix = (matrix: number[][], criteriaIds: string[]): Record<string, number> => {
  const values: Record<string, number> = {}
  const n = criteriaIds.length
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const raw = Number(matrix?.[i]?.[j])
      values[buildPairwiseKey(criteriaIds[i], criteriaIds[j])] = Number.isFinite(raw) && raw > 0 ? raw : 1
    }
  }
  return values
}

// Saved/historical weights are fractions that sum to 1 (backend-normalized);
// the manual sliders expect integers in [1, 40]. Both restore paths (saved
// preference on mount, "Gunakan Bobot" from history) must rescale through
// this so a fraction like 0.19 doesn't just clamp to the slider minimum.
export const rescaleWeightsToSliderRange = (entryWeights: Record<string, number>, base: Record<string, number>): Record<string, number> => {
  const positiveValues = Object.values(entryWeights).filter((value) => Number.isFinite(value) && value > 0)
  if (positiveValues.length === 0) return base
  const maxWeight = Math.max(...positiveValues)
  const scale = 40 / maxWeight
  const next = { ...base }
  Object.entries(entryWeights).forEach(([key, value]) => {
    if (Number.isFinite(value) && value > 0) {
      next[key] = Math.min(40, Math.max(1, Math.round(value * scale)))
    }
  })
  return next
}

export interface PairwiseConsistencyHint {
  rowId: string
  colId: string
  score: number
  isHighContributor: boolean
}

// A pairwise judgment "sticks out" as an inconsistency contributor when its
// stated ratio diverges a lot from the ratio implied by the approximate
// priority vector derived from the whole matrix. Flagging score > log(1.5)
// (~1.5x off from what the rest of the matrix implies) is a reasonable, if
// arbitrary, cutoff for a live UI hint — the backend's CR check remains the
// authoritative consistency measure.
const HIGH_CONTRIBUTOR_THRESHOLD = Math.log(1.5)

export const computePairwiseConsistencyHints = (matrix: number[][], criteriaIds: string[]): PairwiseConsistencyHint[] => {
  const n = criteriaIds.length
  if (n === 0 || matrix.length !== n) return []

  // Classic AHP approximation: normalize each column to sum to 1, then
  // average across each row to get the priority vector.
  const columnSums = Array.from({ length: n }, (_, j) => matrix.reduce((sum, row) => sum + (Number(row[j]) || 0), 0) || 1)
  const priority = Array.from({ length: n }, (_, i) => {
    const rowAverage = matrix[i].reduce((sum, value, j) => sum + (Number(value) || 0) / columnSums[j], 0) / n
    return rowAverage > 0 ? rowAverage : 1e-9
  })

  const hints: PairwiseConsistencyHint[] = []
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const actual = Number(matrix[i][j]) || 1
      const implied = priority[i] / priority[j]
      const score = Math.abs(Math.log(actual) - Math.log(implied))
      hints.push({
        rowId: criteriaIds[i],
        colId: criteriaIds[j],
        score,
        isHighContributor: score > HIGH_CONTRIBUTOR_THRESHOLD,
      })
    }
  }
  return hints
}
