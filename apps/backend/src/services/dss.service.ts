import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { DssRankingHistoryEntry, DssWeightPreference } from '../models/dss.model';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('service:dss');

type AssetType = 'medical' | 'non_medical';
type CriterionType = 'benefit' | 'cost';

export interface DssCriterion {
  id: string;
  name: string;
  type: CriterionType;
  weight: number;
}

export interface DssAssetRanking {
  rank: number;
  assetId: number;
  assetType: AssetType;
  assetName: string;
  assetCode: string;
  assetCategory: string;
  assetLocation?: string | null;
  detailId: string;
  detailName: string;
  detailCode: string;
  serialNumber?: string | null;
  detailType?: string | null;
  conditionLabel: string;
  statusLabel: string;
  purchaseDate?: string | null;
  lastMaintenance?: string | null;
  lastRepair?: string | null;
  nextMaintenance?: string | null;
  integrationCategory: 'normal' | 'warning' | 'mandatory_check';
  usageWarningThreshold: number;
  usageMandatoryCheckThreshold: number;
  criteriaScores: Record<string, number>;
  normalizedScores: Record<string, number>;
  weightedScores: Record<string, number>;
  positiveDistance: number;
  negativeDistance: number;
  preferenceScore: number;
  recommendation: string;
}

export interface DssRankingResult {
  criteria: DssCriterion[];
  consistency: {
    lambdaMax: number;
    consistencyIndex: number;
    consistencyRatio: number;
    isConsistent: boolean;
  } | null;
  idealSolutions: {
    positive: Record<string, number>;
    negative: Record<string, number>;
  };
  generatedAt: string;
  totalAlternatives: number;
  rankings: DssAssetRanking[];
}

type RankingOptions = {
  pairwiseMatrix?: number[][];
  weights?: Record<string, number>;
  assetType?: AssetType | 'all';
  limit?: number;
};

interface AssetRow extends RowDataPacket {
  id: number;
  asset_code: string;
  name: string;
  category: string;
  type?: string | null;
  status?: string | null;
  condition?: string | null;
  location?: string | null;
  purchase_date?: string | Date | null;
  specifications?: string | Record<string, any> | null;
}

interface CountRow extends RowDataPacket {
  asset_id: number;
  asset_type?: string | null;
  asset_detail_id?: string | null;
  asset_detail_code?: string | null;
  count: number;
}

interface MaintenanceCountRow extends CountRow {
  total_cost?: number | null;
}

interface WeightPreferenceRow extends RowDataPacket {
  user_id: number;
  weights_json: string;
  asset_type: string;
  updated_at: Date;
}

interface RankingHistoryRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  asset_type: string;
  weights_json: string;
  pairwise_matrix_json: string | null;
  criteria_json: string;
  total_alternatives: number;
  top_rankings_json: string | null;
  generated_at: Date;
  created_at: Date;
}

const parseJsonObject = (raw: string | null): Record<string, number> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const parseJsonArray = <T>(raw: string | null): T[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const DEFAULT_CRITERIA: Array<Omit<DssCriterion, 'weight'>> = [
  { id: 'condition', name: 'Kondisi Aset', type: 'benefit' },
  { id: 'age', name: 'Usia Aset', type: 'benefit' },
  { id: 'maintenanceDue', name: 'Kedekatan Jadwal Maintenance', type: 'benefit' },
  { id: 'usageFrequency', name: 'Frekuensi Pemakaian', type: 'benefit' },
  { id: 'maintenanceHistory', name: 'Riwayat Maintenance', type: 'benefit' },
  { id: 'functionalUrgency', name: 'Urgensi Fungsi', type: 'benefit' },
  { id: 'statusRisk', name: 'Risiko Status', type: 'benefit' },
  { id: 'maintenanceCost', name: 'Akumulasi Biaya Maintenance', type: 'cost' },
];

const DEFAULT_WEIGHTS: Record<string, number> = {
  condition: 0.19,
  age: 0.12,
  maintenanceDue: 0.15,
  usageFrequency: 0.13,
  maintenanceHistory: 0.13,
  functionalUrgency: 0.14,
  statusRisk: 0.06,
  maintenanceCost: 0.08,
};

// Criteria whose raw values have no fixed 1-5 ceiling (years, counts, rupiah).
// These are rescaled into 1-5 quintile buckets relative to the current
// dataset so they don't dominate the TOPSIS distance purely due to scale.
const UNBOUNDED_CRITERIA_IDS = ['age', 'usageFrequency', 'maintenanceHistory', 'maintenanceCost'];

export const scaleToQuintileBuckets = (values: number[]): number[] => {
  const n = values.length;
  if (n === 0) return [];
  const indexed = values.map((value, index) => ({ value, index }));
  const sorted = [...indexed].sort((a, b) => a.value - b.value);
  const allEqual = sorted.every((entry) => entry.value === sorted[0].value);
  if (allEqual) return values.map(() => 3);

  const buckets = new Array(n).fill(1);
  sorted.forEach((entry, rank) => {
    buckets[entry.index] = Math.min(5, Math.floor((rank / n) * 5) + 1);
  });
  return buckets;
};

const RANDOM_INDEX: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
};

type DetailAlternative = {
  assetId: number;
  assetType: AssetType;
  assetName: string;
  assetCode: string;
  assetCategory: string;
  assetLocation?: string | null;
  detailId: string;
  detailName: string;
  detailCode: string;
  serialNumber?: string | null;
  detailType?: string | null;
  conditionLabel: string;
  statusLabel: string;
  purchaseDate?: string | null;
  lastMaintenance?: string | null;
  lastRepair?: string | null;
  nextMaintenance?: string | null;
  integrationCategory: 'normal' | 'warning' | 'mandatory_check';
  criteriaScores: Record<string, number>;
};

const USAGE_WARNING_THRESHOLD = 10;
const USAGE_MANDATORY_CHECK_THRESHOLD = 25;

export const resolveUsageIntegrationCategory = (usageFrequency: number): 'normal' | 'warning' | 'mandatory_check' => {
  if (usageFrequency >= USAGE_MANDATORY_CHECK_THRESHOLD) return 'mandatory_check';
  if (usageFrequency > USAGE_WARNING_THRESHOLD) return 'warning';
  return 'normal';
};

const normalizeDate = (value?: string | Date | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const daysBetween = (from: Date, to: Date): number => {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / dayMs);
};

const parseSpecifications = (raw: unknown): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw as Record<string, any> : {};
};

export const normalizeConditionScore = (value?: string | null): number => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('rusak') || normalized.includes('damaged')) return 5;
  if (normalized.includes('poor') || normalized.includes('buruk') || normalized.includes('kurang')) return 4;
  if (normalized.includes('cukup') || normalized.includes('fair')) return 3;
  if (normalized.includes('baik') || normalized.includes('good')) return 1;
  // Unrecognized/missing condition label: treat as neutral rather than
  // assuming best condition, so bad data doesn't silently drop priority.
  return 3;
};

export const normalizeStatusRisk = (value?: string | null): number => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('disposed') || normalized.includes('non')) return 5;
  if (normalized.includes('maintenance') || normalized.includes('perbaikan')) return 4;
  if (normalized.includes('borrowed') || normalized.includes('dipinjam')) return 3;
  if (normalized.includes('digunakan') || normalized.includes('in_use') || normalized.includes('in use')) return 2;
  return 1;
};

export const normalizeFunctionalUrgency = (detailName?: string | null, detailType?: string | null, category?: string | null): number => {
  const text = `${detailName || ''} ${detailType || ''} ${category || ''}`.toLowerCase();
  if (/(ventilator|defibrillator|aed|crash|resuscitation|monitor|infusion|syringe|oxygen|suction|ctg|incubator|icu|emergency)/.test(text)) return 5;
  if (/(ecg|ekg|pump|bed|stretcher|doppler|radiology|diagnostic|respiratory|fire|apar|ups|power|security|smoke)/.test(text)) return 4;
  if (/(thermometer|stethoscope|cctv|network|access|hvac|ahu|hepa|sanitation)/.test(text)) return 3;
  if (/(storage|rack|whiteboard|display|office)/.test(text)) return 1;
  return 2;
};

const buildDetailKey = (assetType: AssetType, assetId: number, detailId?: string | null, detailCode?: string | null): string => {
  const id = String(detailId || '').trim();
  const code = String(detailCode || '').trim();
  return `${assetType}|${assetId}|${id || code || 'asset'}`;
};

const isNumericId = (value: unknown): value is string | number => {
  const normalized = String(value ?? '').trim();
  return /^\d+$/.test(normalized);
};

const buildAssetLocationLookup = (assets: AssetRow[]): Map<string, string> => {
  const lookup = new Map<string, string>();
  assets.forEach((asset) => {
    const assetType: AssetType = asset.type === 'non_medical' ? 'non_medical' : 'medical';
    const label = String(asset.location || asset.name || '').trim();
    if (label) {
      lookup.set(`${assetType}|${asset.id}`, label);
    }
  });
  return lookup;
};

const resolveDetailLocation = (
  detail: Record<string, any>,
  asset: AssetRow,
  assetType: AssetType,
  assetLocationLookup: Map<string, string>
): string | null => {
  const rawLocation =
    detail.roomId ??
    detail.roomName ??
    detail.room_name ??
    detail.ruangan ??
    detail.lokasi ??
    detail.location ??
    detail.room?.name ??
    detail.room?.roomName;

  if (isNumericId(rawLocation)) {
    return assetLocationLookup.get(`${assetType}|${String(rawLocation).trim()}`) || asset.location || asset.name || null;
  }

  const normalizedLocation = String(rawLocation || '').trim();
  return normalizedLocation || asset.location || asset.name || null;
};

export const normalizeWeights = (weights: Record<string, number>): Record<string, number> => {
  const sanitized = DEFAULT_CRITERIA.reduce<Record<string, number>>((acc, criterion) => {
    const value = Number(weights[criterion.id]);
    acc[criterion.id] = Number.isFinite(value) && value > 0 ? value : 0;
    return acc;
  }, {});
  const total = Object.values(sanitized).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  return Object.fromEntries(Object.entries(sanitized).map(([key, value]) => [key, value / total]));
};

export const calculateAhpWeights = (matrix: number[][]): { weights: Record<string, number>; consistency: NonNullable<DssRankingResult['consistency']> } | null => {
  const n = DEFAULT_CRITERIA.length;
  if (!Array.isArray(matrix) || matrix.length !== n || matrix.some((row) => !Array.isArray(row) || row.length !== n)) {
    return null;
  }

  const numericMatrix = matrix.map((row) => row.map((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }));

  // Power iteration to estimate principal eigenvector (more stable than simple column-normalization)
  let v = Array.from({ length: n }, () => 1 / n);
  const maxIter = 1000;
  const tol = 1e-12;
  for (let iter = 0; iter < maxIter; iter += 1) {
    const next = numericMatrix.map((row) => row.reduce((sum, value, j) => sum + value * v[j], 0));
    const s = next.reduce((acc, x) => acc + x, 0) || 1;
    const nextNorm = next.map((x) => x / s);
    const diff = Math.max(...nextNorm.map((x, i) => Math.abs(x - v[i])));
    v = nextNorm;
    if (diff < tol) break;
  }

  const weightsVec = v.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const weightSum = weightsVec.reduce((s, x) => s + x, 0) || 1;
  const normalizedWeights = weightsVec.map((w) => w / weightSum);

  const weightedSums = numericMatrix.map((row) => row.reduce((sum, value, j) => sum + value * normalizedWeights[j], 0));
  const lambdaMax = weightedSums.reduce((sum, value, i) => sum + (value / (normalizedWeights[i] || 1)), 0) / n;
  const consistencyIndex = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const consistencyRatio = (RANDOM_INDEX[n] || 1.49) === 0 ? 0 : consistencyIndex / (RANDOM_INDEX[n] || 1.49);

  return {
    weights: Object.fromEntries(DEFAULT_CRITERIA.map((criterion, index) => [criterion.id, normalizedWeights[index]])),
    consistency: {
      lambdaMax,
      consistencyIndex,
      consistencyRatio,
      isConsistent: Number.isFinite(consistencyRatio) ? consistencyRatio <= 0.1 : false,
    },
  };
};

export class DssService {
  private async getAssets(assetType: RankingOptions['assetType']): Promise<AssetRow[]> {
    const medicalQuery = `SELECT *, 'medical' as type FROM medical_assets`;
    const nonMedicalQuery = `SELECT *, 'non_medical' as type FROM non_medical_assets`;

    if (assetType === 'medical') {
      const [rows] = await pool.query<AssetRow[]>(medicalQuery);
      return rows;
    }
    if (assetType === 'non_medical') {
      const [rows] = await pool.query<AssetRow[]>(nonMedicalQuery);
      return rows;
    }

    const [medicalRows] = await pool.query<AssetRow[]>(medicalQuery);
    const [nonMedicalRows] = await pool.query<AssetRow[]>(nonMedicalQuery);
    return [...medicalRows, ...nonMedicalRows];
  }

  private async getUsageCounts(): Promise<Map<string, number>> {
    const [rows] = await pool.query<CountRow[]>(
      `SELECT asset_id, COALESCE(asset_type, 'medical') as asset_type, asset_detail_id, asset_detail_code, COUNT(*) as count
       FROM asset_usage_logs
       GROUP BY asset_id, COALESCE(asset_type, 'medical'), asset_detail_id, asset_detail_code`
    );

    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const assetType = row.asset_type === 'non_medical' ? 'non_medical' : 'medical';
      counts.set(buildDetailKey(assetType, row.asset_id, row.asset_detail_id, row.asset_detail_code), Number(row.count) || 0);
    });
    return counts;
  }

  private async getMaintenanceCounts(): Promise<{ counts: Map<string, number>; costs: Map<string, number> }> {
    const [rows] = await pool.query<MaintenanceCountRow[]>(
      `SELECT asset_id, COALESCE(asset_type, 'medical') as asset_type, asset_detail_id, asset_detail_code, COUNT(*) as count, COALESCE(SUM(cost), 0) as total_cost
       FROM maintenance_records
       WHERE status <> 'cancelled'
       GROUP BY asset_id, COALESCE(asset_type, 'medical'), asset_detail_id, asset_detail_code`
    );

    const counts = new Map<string, number>();
    const costs = new Map<string, number>();
    rows.forEach((row) => {
      const assetType = row.asset_type === 'non_medical' ? 'non_medical' : 'medical';
      const key = buildDetailKey(assetType, row.asset_id, row.asset_detail_id, row.asset_detail_code);
      counts.set(key, Number(row.count) || 0);
      costs.set(key, Number(row.total_cost) || 0);
    });
    return { counts, costs };
  }

  private buildAlternatives(
    assets: AssetRow[],
    usageCounts: Map<string, number>,
    maintenanceCounts: Map<string, number>,
    maintenanceCosts: Map<string, number>
  ): DetailAlternative[] {
    const today = new Date();
    const assetLocationLookup = buildAssetLocationLookup(assets);

    return assets.flatMap((asset) => {
      const assetType: AssetType = asset.type === 'non_medical' ? 'non_medical' : 'medical';
      const specifications = parseSpecifications(asset.specifications);
      const details = Array.isArray(specifications.details) ? specifications.details : [];
      const sourceDetails = details.length > 0 ? details : [{
        id: `asset-${assetType}-${asset.id}`,
        assetCode: asset.asset_code,
        inventoryName: asset.name,
        condition: asset.condition,
        status: asset.status,
        purchaseDate: asset.purchase_date,
        roomId: asset.location,
      }];

      return sourceDetails.map((detail: Record<string, any>, index: number) => {
        const detailId = String(detail.id || detail.detailId || detail.assetDetailId || detail.assetCode || `${asset.id}-detail-${index}`);
        const detailCode = String(detail.assetCode || detail.detailCode || asset.asset_code);
        const detailName = String(detail.inventoryName || detail.name || asset.name);
        const serialNumber = detail.serialNumber ? String(detail.serialNumber) : null;
        const conditionLabel = String(detail.condition || asset.condition || 'Baik');
        const statusLabel = String(detail.status || asset.status || 'Tersedia');
        const purchaseDate = normalizeDate(detail.purchaseDate || asset.purchase_date);
        const lastMaintenance = normalizeDate(detail.lastMaintenance);
        const lastRepair = normalizeDate(detail.lastRepair);
        const nextMaintenance = normalizeDate(detail.nextMaintenance);
        const key = buildDetailKey(assetType, asset.id, detailId, detailCode);

        const purchase = purchaseDate ? new Date(purchaseDate) : null;
        const next = nextMaintenance ? new Date(nextMaintenance) : null;
        const ageDays = purchase && !Number.isNaN(purchase.getTime()) ? Math.max(0, daysBetween(purchase, today)) : 0;
        const maintenanceDueDays = next && !Number.isNaN(next.getTime()) ? daysBetween(today, next) : 365;
        const maintenanceDueScore = maintenanceDueDays < 0 ? 5 : maintenanceDueDays <= 30 ? 4 : maintenanceDueDays <= 90 ? 3 : maintenanceDueDays <= 180 ? 2 : 1;
        const usageFrequency = usageCounts.get(key) || 0;

        return {
          assetId: asset.id,
          assetType,
          assetName: asset.name,
          assetCode: asset.asset_code,
          assetCategory: asset.category,
          assetLocation: resolveDetailLocation(detail, asset, assetType, assetLocationLookup),
          detailId,
          detailName,
          detailCode,
          serialNumber,
          detailType: detail.type || null,
          conditionLabel,
          statusLabel,
          purchaseDate,
          lastMaintenance,
          lastRepair,
          nextMaintenance,
          integrationCategory: resolveUsageIntegrationCategory(usageFrequency),
          criteriaScores: {
            condition: normalizeConditionScore(conditionLabel),
            age: Math.max(1, Math.round(ageDays / 365)),
            maintenanceDue: maintenanceDueScore,
            usageFrequency,
            maintenanceHistory: maintenanceCounts.get(key) || 0,
            functionalUrgency: normalizeFunctionalUrgency(detailName, detail.type, asset.category),
            statusRisk: normalizeStatusRisk(statusLabel),
            maintenanceCost: maintenanceCosts.get(key) || 0,
          },
        };
      });
    });
  }

  async rankAssets(options: RankingOptions = {}): Promise<DssRankingResult> {
    try {
      const ahpComputed = options.pairwiseMatrix ? calculateAhpWeights(options.pairwiseMatrix) : null;
      const useAhp = ahpComputed && ahpComputed.consistency && ahpComputed.consistency.isConsistent;
      if (ahpComputed && !useAhp) {
        logger.warn('Provided AHP pairwise matrix is inconsistent (CR > 0.1); falling back to provided/default weights');
      }
      const weights = normalizeWeights(useAhp ? ahpComputed!.weights : (options.weights || DEFAULT_WEIGHTS));
      const criteria = DEFAULT_CRITERIA.map((criterion) => ({ ...criterion, weight: weights[criterion.id] || 0 }));
      const [assets, usageCounts, maintenance] = await Promise.all([
        this.getAssets(options.assetType || 'all'),
        this.getUsageCounts(),
        this.getMaintenanceCounts(),
      ]);
      const alternatives = this.buildAlternatives(assets, usageCounts, maintenance.counts, maintenance.costs);

      if (!Array.isArray(alternatives) || alternatives.length === 0) {
        logger.warn('No alternatives found for ranking (empty dataset)');
        return {
          criteria,
          consistency: ahpComputed?.consistency || null,
          idealSolutions: { positive: {}, negative: {} },
          generatedAt: new Date().toISOString(),
          totalAlternatives: 0,
          rankings: [],
        };
      }

      // Unbounded raw criteria (years, counts, rupiah) get rescaled onto the
      // same 1-5 range as the other criteria before normalization, so their
      // arbitrary scale doesn't distort the weighted TOPSIS distance.
      UNBOUNDED_CRITERIA_IDS.forEach((criterionId) => {
        if (!criteria.some((criterion) => criterion.id === criterionId)) return;
        const rawValues = alternatives.map((alternative) => Number(alternative.criteriaScores[criterionId]) || 0);
        const bucketed = scaleToQuintileBuckets(rawValues);
        alternatives.forEach((alternative, index) => {
          alternative.criteriaScores[criterionId] = bucketed[index];
        });
      });

      const denominators = Object.fromEntries(criteria.map((criterion) => {
        const sumSquares = alternatives.reduce((sum, alternative) => {
          const value = Number(alternative.criteriaScores[criterion.id]) || 0;
          return sum + value * value;
        }, 0);
        const denom = Math.sqrt(sumSquares);
        return [criterion.id, denom > 0 ? denom : 1];
      }));

      const positiveIdeal: Record<string, number> = {};
      const negativeIdeal: Record<string, number> = {};
      const scored = alternatives.map((alternative) => {
        const normalizedScores: Record<string, number> = {};
        const weightedScores: Record<string, number> = {};
        criteria.forEach((criterion) => {
          const raw = Number(alternative.criteriaScores[criterion.id]) || 0;
          const normalized = Number.isFinite(raw) ? raw / denominators[criterion.id] : 0;
          const weighted = Number.isFinite(normalized) && Number.isFinite(criterion.weight) ? normalized * criterion.weight : 0;
          normalizedScores[criterion.id] = Number.isFinite(normalized) ? normalized : 0;
          weightedScores[criterion.id] = Number.isFinite(weighted) ? weighted : 0;
        });
        return { ...alternative, normalizedScores, weightedScores };
      });

      criteria.forEach((criterion) => {
        const values = scored.map((alternative) => alternative.weightedScores[criterion.id] || 0);
        positiveIdeal[criterion.id] = values.length > 0 ? (criterion.type === 'benefit' ? Math.max(...values) : Math.min(...values)) : 0;
        negativeIdeal[criterion.id] = values.length > 0 ? (criterion.type === 'benefit' ? Math.min(...values) : Math.max(...values)) : 0;
      });

      const distanced = scored
        .map((alternative) => {
          const positiveDistance = Math.sqrt(criteria.reduce((sum, criterion) => {
            const diff = (alternative.weightedScores[criterion.id] || 0) - (positiveIdeal[criterion.id] || 0);
            return sum + diff * diff;
          }, 0));
          const negativeDistance = Math.sqrt(criteria.reduce((sum, criterion) => {
            const diff = (alternative.weightedScores[criterion.id] || 0) - (negativeIdeal[criterion.id] || 0);
            return sum + diff * diff;
          }, 0));
          const denom = positiveDistance + negativeDistance;
          const preferenceScore = denom === 0 ? 0 : (negativeDistance / denom);
          return { ...alternative, positiveDistance, negativeDistance, preferenceScore };
        })
        .sort((left, right) => right.preferenceScore - left.preferenceScore);

      // Recommendation bands are relative to this dataset's own ranking
      // (top ~20% / next ~30% / rest) rather than fixed absolute score
      // cutoffs, which in practice were rarely reached by real data.
      const totalDistanced = distanced.length;
      const withRecommendation = distanced.map((alternative, index) => {
        const percentile = (index + 1) / totalDistanced;
        const recommendation = percentile <= 0.2
          ? 'Prioritas tinggi'
          : percentile <= 0.5
            ? 'Prioritas sedang'
            : 'Prioritas rendah';
        return { ...alternative, recommendation };
      });

      const rankings = withRecommendation
        .slice(0, Math.max(1, Math.min(Number(options.limit) || 100, 1000)))
        .map((alternative, index) => ({
          ...alternative,
          rank: index + 1,
          usageWarningThreshold: USAGE_WARNING_THRESHOLD,
          usageMandatoryCheckThreshold: USAGE_MANDATORY_CHECK_THRESHOLD,
        }));

      return {
        criteria,
        consistency: ahpComputed?.consistency || null,
        idealSolutions: { positive: positiveIdeal, negative: negativeIdeal },
        generatedAt: new Date().toISOString(),
        totalAlternatives: alternatives.length,
        rankings,
      };
    } catch (err) {
      logger.error('Error ranking assets', { error: err });
      throw err;
    }
  }

  async getWeightPreference(userId: number): Promise<DssWeightPreference | null> {
    const [rows] = await pool.query<WeightPreferenceRow[]>(
      `SELECT user_id, weights_json, asset_type, updated_at FROM dss_weight_preferences WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      weights: parseJsonObject(row.weights_json),
      assetType: row.asset_type,
      updatedAt: row.updated_at,
    };
  }

  async saveWeightPreference(userId: number, weights: Record<string, number>, assetType: string): Promise<DssWeightPreference> {
    await pool.query(
      `INSERT INTO dss_weight_preferences (user_id, weights_json, asset_type)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE weights_json = VALUES(weights_json), asset_type = VALUES(asset_type)`,
      [userId, JSON.stringify(weights), assetType]
    );
    return { userId, weights, assetType, updatedAt: new Date().toISOString() };
  }

  async saveRankingHistory(userId: number | null, assetType: string, result: DssRankingResult, pairwiseMatrix?: number[][] | null): Promise<void> {
    const weightsJson = JSON.stringify(Object.fromEntries(result.criteria.map((criterion) => [criterion.id, criterion.weight])));

    // Skip persisting when the last saved snapshot for this user used the exact same
    // weights and asset type — avoids piling up identical rows on plain page reloads
    // (loadRanking runs on every mount, not just when the user actually changes weights).
    const [lastRows] = await pool.query<(RowDataPacket & { asset_type: string; weights_json: string })[]>(
      `SELECT asset_type, weights_json FROM dss_ranking_history
       WHERE user_id ${userId === null ? 'IS NULL' : '= ?'}
       ORDER BY created_at DESC LIMIT 1`,
      userId === null ? [] : [userId]
    );
    const last = lastRows[0];
    if (last && last.asset_type === assetType && last.weights_json === weightsJson) {
      return;
    }

    const topRankings = result.rankings.slice(0, 10).map((ranking) => ({
      rank: ranking.rank,
      detailName: ranking.detailName,
      detailCode: ranking.detailCode,
      preferenceScore: ranking.preferenceScore,
      recommendation: ranking.recommendation,
    }));
    await pool.query(
      `INSERT INTO dss_ranking_history (user_id, asset_type, weights_json, pairwise_matrix_json, criteria_json, total_alternatives, top_rankings_json, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        assetType,
        weightsJson,
        pairwiseMatrix ? JSON.stringify(pairwiseMatrix) : null,
        JSON.stringify(result.criteria),
        result.totalAlternatives,
        JSON.stringify(topRankings),
        new Date(result.generatedAt),
      ]
    );
  }

  async listRankingHistory(userId: number, limit = 20): Promise<DssRankingHistoryEntry[]> {
    const [rows] = await pool.query<RankingHistoryRow[]>(
      `SELECT id, user_id, asset_type, weights_json, pairwise_matrix_json, criteria_json, total_alternatives, top_rankings_json, generated_at, created_at
       FROM dss_ranking_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, Math.max(1, Math.min(limit, 100))]
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      assetType: row.asset_type,
      weights: parseJsonObject(row.weights_json),
      criteria: parseJsonArray(row.criteria_json),
      totalAlternatives: row.total_alternatives,
      topRankings: parseJsonArray(row.top_rankings_json),
      generatedAt: row.generated_at,
      createdAt: row.created_at,
      pairwiseMatrix: row.pairwise_matrix_json ? parseJsonArray<number[]>(row.pairwise_matrix_json) : null,
    }));
  }

  async deleteRankingHistory(userId: number, historyId: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM dss_ranking_history WHERE id = ? AND user_id = ?`,
      [historyId, userId]
    );
    return result.affectedRows > 0;
  }
}

export default new DssService();
