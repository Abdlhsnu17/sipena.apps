import { RowDataPacket } from 'mysql2';
import pool from '../config/database';

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
  detailType?: string | null;
  conditionLabel: string;
  statusLabel: string;
  purchaseDate?: string | null;
  lastMaintenance?: string | null;
  nextMaintenance?: string | null;
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
  { id: 'condition', name: 'Kondisi Aset', type: 'cost' },
  { id: 'age', name: 'Usia Aset', type: 'cost' },
  { id: 'maintenanceDue', name: 'Kedekatan Jadwal Maintenance', type: 'cost' },
  { id: 'usageFrequency', name: 'Frekuensi Pemakaian', type: 'benefit' },
  { id: 'maintenanceHistory', name: 'Riwayat Maintenance', type: 'cost' },
  { id: 'functionalUrgency', name: 'Urgensi Fungsi', type: 'benefit' },
  { id: 'statusRisk', name: 'Risiko Status', type: 'cost' },
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
  detailType?: string | null;
  conditionLabel: string;
  statusLabel: string;
  purchaseDate?: string | null;
  lastMaintenance?: string | null;
  nextMaintenance?: string | null;
  criteriaScores: Record<string, number>;
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

  const columnTotals = Array.from({ length: n }, (_, columnIndex) =>
    numericMatrix.reduce((sum, row) => sum + row[columnIndex], 0)
  );
  const priorityVector = numericMatrix.map((row) =>
    row.reduce((sum, value, columnIndex) => sum + value / (columnTotals[columnIndex] || 1), 0) / n
  );
  const weightedSums = numericMatrix.map((row) =>
    row.reduce((sum, value, columnIndex) => sum + value * priorityVector[columnIndex], 0)
  );
  const lambdaMax = weightedSums.reduce((sum, value, index) => sum + value / (priorityVector[index] || 1), 0) / n;
  const consistencyIndex = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const consistencyRatio = (RANDOM_INDEX[n] || 1.49) === 0 ? 0 : consistencyIndex / (RANDOM_INDEX[n] || 1.49);

  return {
    weights: Object.fromEntries(DEFAULT_CRITERIA.map((criterion, index) => [criterion.id, priorityVector[index]])),
    consistency: {
      lambdaMax,
      consistencyIndex,
      consistencyRatio,
      isConsistent: consistencyRatio <= 0.1,
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
        const conditionLabel = String(detail.condition || asset.condition || 'Baik');
        const statusLabel = String(detail.status || asset.status || 'Aktif');
        const purchaseDate = normalizeDate(detail.purchaseDate || asset.purchase_date);
        const lastMaintenance = normalizeDate(detail.lastMaintenance);
        const nextMaintenance = normalizeDate(detail.nextMaintenance);
        const key = buildDetailKey(assetType, asset.id, detailId, detailCode);

        const purchase = purchaseDate ? new Date(purchaseDate) : null;
        const next = nextMaintenance ? new Date(nextMaintenance) : null;
        const ageDays = purchase && !Number.isNaN(purchase.getTime()) ? Math.max(0, daysBetween(purchase, today)) : 0;
        const maintenanceDueDays = next && !Number.isNaN(next.getTime()) ? daysBetween(today, next) : 365;
        const maintenanceDueScore = maintenanceDueDays < 0 ? 5 : maintenanceDueDays <= 30 ? 4 : maintenanceDueDays <= 90 ? 3 : maintenanceDueDays <= 180 ? 2 : 1;

        return {
          assetId: asset.id,
          assetType,
          assetName: asset.name,
          assetCode: asset.asset_code,
          assetCategory: asset.category,
          assetLocation: detail.roomId || detail.location || asset.location,
          detailId,
          detailName,
          detailCode,
          detailType: detail.type || null,
          conditionLabel,
          statusLabel,
          purchaseDate,
          lastMaintenance,
          nextMaintenance,
          criteriaScores: {
            condition: normalizeConditionScore(conditionLabel),
            age: Math.max(1, Math.round(ageDays / 365)),
            maintenanceDue: maintenanceDueScore,
            usageFrequency: usageCounts.get(key) || 0,
            maintenanceHistory: maintenanceCounts.get(key) || 0,
            functionalUrgency: normalizeFunctionalUrgency(detailName, detail.type, asset.category),
            statusRisk: normalizeStatusRisk(statusLabel),
          },
        };
      });
    });
  }

  async rankAssets(options: RankingOptions = {}): Promise<DssRankingResult> {
    const ahp = options.pairwiseMatrix ? calculateAhpWeights(options.pairwiseMatrix) : null;
    const weights = normalizeWeights(ahp?.weights || options.weights || DEFAULT_WEIGHTS);
    const criteria = DEFAULT_CRITERIA.map((criterion) => ({ ...criterion, weight: weights[criterion.id] || 0 }));
    const [assets, usageCounts, maintenanceCounts] = await Promise.all([
      this.getAssets(options.assetType || 'all'),
      this.getUsageCounts(),
      this.getMaintenanceCounts(),
    ]);
    const alternatives = this.buildAlternatives(assets, usageCounts, maintenanceCounts);
    const denominators = Object.fromEntries(criteria.map((criterion) => {
      const sumSquares = alternatives.reduce((sum, alternative) => {
        const value = alternative.criteriaScores[criterion.id] || 0;
        return sum + value * value;
      }, 0);
      return [criterion.id, Math.sqrt(sumSquares) || 1];
    }));

    const positiveIdeal: Record<string, number> = {};
    const negativeIdeal: Record<string, number> = {};
    const scored = alternatives.map((alternative) => {
      const normalizedScores: Record<string, number> = {};
      const weightedScores: Record<string, number> = {};
      criteria.forEach((criterion) => {
        normalizedScores[criterion.id] = (alternative.criteriaScores[criterion.id] || 0) / denominators[criterion.id];
        weightedScores[criterion.id] = normalizedScores[criterion.id] * criterion.weight;
      });
      return { ...alternative, normalizedScores, weightedScores };
    });

    criteria.forEach((criterion) => {
      const values = scored.map((alternative) => alternative.weightedScores[criterion.id]);
      positiveIdeal[criterion.id] = criterion.type === 'benefit' ? Math.max(...values) : Math.min(...values);
      negativeIdeal[criterion.id] = criterion.type === 'benefit' ? Math.min(...values) : Math.max(...values);
    });

    const rankings = scored
      .map((alternative) => {
        const positiveDistance = Math.sqrt(criteria.reduce((sum, criterion) => {
          const diff = alternative.weightedScores[criterion.id] - positiveIdeal[criterion.id];
          return sum + diff * diff;
        }, 0));
        const negativeDistance = Math.sqrt(criteria.reduce((sum, criterion) => {
          const diff = alternative.weightedScores[criterion.id] - negativeIdeal[criterion.id];
          return sum + diff * diff;
        }, 0));
        const preferenceScore = positiveDistance + negativeDistance === 0
          ? 0
          : negativeDistance / (positiveDistance + negativeDistance);
        const recommendation = preferenceScore >= 0.7
          ? 'Prioritas tinggi'
          : preferenceScore >= 0.45
            ? 'Prioritas sedang'
            : 'Prioritas rendah';
        return { ...alternative, positiveDistance, negativeDistance, preferenceScore, recommendation };
      })
      .sort((left, right) => right.preferenceScore - left.preferenceScore)
      .slice(0, Math.max(1, Math.min(Number(options.limit) || 100, 1000)))
      .map((alternative, index) => ({ ...alternative, rank: index + 1 }));

    return {
      criteria,
      consistency: ahp?.consistency || null,
      generatedAt: new Date().toISOString(),
      totalAlternatives: alternatives.length,
      rankings,
    };
  }
}

export default new DssService();
