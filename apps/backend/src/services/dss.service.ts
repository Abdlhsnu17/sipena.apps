import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
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

const DEFAULT_CRITERIA: Array<Omit<DssCriterion, 'weight'>> = [
  { id: 'condition', name: 'Kondisi Aset', type: 'benefit' },
  { id: 'age', name: 'Usia Aset', type: 'benefit' },
  { id: 'maintenanceDue', name: 'Kedekatan Jadwal Maintenance', type: 'benefit' },
  { id: 'usageFrequency', name: 'Frekuensi Pemakaian', type: 'benefit' },
  { id: 'maintenanceHistory', name: 'Riwayat Maintenance', type: 'benefit' },
  { id: 'functionalUrgency', name: 'Urgensi Fungsi', type: 'benefit' },
  { id: 'statusRisk', name: 'Risiko Status', type: 'benefit' },
];

const DEFAULT_WEIGHTS: Record<string, number> = {
  condition: 0.22,
  age: 0.12,
  maintenanceDue: 0.16,
  usageFrequency: 0.14,
  maintenanceHistory: 0.14,
  functionalUrgency: 0.16,
  statusRisk: 0.06,
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

const resolveUsageIntegrationCategory = (usageFrequency: number): 'normal' | 'warning' | 'mandatory_check' => {
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

const normalizeConditionScore = (value?: string | null): number => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('rusak') || normalized.includes('damaged')) return 5;
  if (normalized.includes('poor') || normalized.includes('buruk') || normalized.includes('kurang')) return 4;
  if (normalized.includes('cukup') || normalized.includes('fair')) return 3;
  return 1;
};

const normalizeStatusRisk = (value?: string | null): number => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('disposed') || normalized.includes('non')) return 5;
  if (normalized.includes('maintenance') || normalized.includes('perbaikan')) return 4;
  if (normalized.includes('borrowed') || normalized.includes('dipinjam')) return 3;
  if (normalized.includes('digunakan') || normalized.includes('in_use') || normalized.includes('in use')) return 2;
  return 1;
};

const normalizeFunctionalUrgency = (detailName?: string | null, detailType?: string | null, category?: string | null): number => {
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

const normalizeWeights = (weights: Record<string, number>): Record<string, number> => {
  const sanitized = DEFAULT_CRITERIA.reduce<Record<string, number>>((acc, criterion) => {
    const value = Number(weights[criterion.id]);
    acc[criterion.id] = Number.isFinite(value) && value > 0 ? value : 0;
    return acc;
  }, {});
  const total = Object.values(sanitized).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  return Object.fromEntries(Object.entries(sanitized).map(([key, value]) => [key, value / total]));
};

const calculateAhpWeights = (matrix: number[][]): { weights: Record<string, number>; consistency: NonNullable<DssRankingResult['consistency']> } | null => {
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

  private async getMaintenanceCounts(): Promise<Map<string, number>> {
    const [rows] = await pool.query<MaintenanceCountRow[]>(
      `SELECT asset_id, COALESCE(asset_type, 'medical') as asset_type, asset_detail_id, asset_detail_code, COUNT(*) as count, COALESCE(SUM(cost), 0) as total_cost
       FROM maintenance_records
       WHERE status <> 'cancelled'
       GROUP BY asset_id, COALESCE(asset_type, 'medical'), asset_detail_id, asset_detail_code`
    );

    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const assetType = row.asset_type === 'non_medical' ? 'non_medical' : 'medical';
      counts.set(buildDetailKey(assetType, row.asset_id, row.asset_detail_id, row.asset_detail_code), Number(row.count) || 0);
    });
    return counts;
  }

  private buildAlternatives(assets: AssetRow[], usageCounts: Map<string, number>, maintenanceCounts: Map<string, number>): DetailAlternative[] {
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
      const [assets, usageCounts, maintenanceCounts] = await Promise.all([
        this.getAssets(options.assetType || 'all'),
        this.getUsageCounts(),
        this.getMaintenanceCounts(),
      ]);
      const alternatives = this.buildAlternatives(assets, usageCounts, maintenanceCounts);

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

      const rankings = scored
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
          const recommendation = preferenceScore >= 0.7
            ? 'Prioritas tinggi'
            : preferenceScore >= 0.45
              ? 'Prioritas sedang'
              : 'Prioritas rendah';
          return { ...alternative, positiveDistance, negativeDistance, preferenceScore, recommendation };
        })
        .sort((left, right) => right.preferenceScore - left.preferenceScore)
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
}

export default new DssService();
