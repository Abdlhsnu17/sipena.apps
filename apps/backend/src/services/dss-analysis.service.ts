import { createScopedLogger } from '../utils/logger';
import { kendallTau, McdmCriterion, runSaw, runTopsis, runWp, spearmanRho, topKOverlapRatio } from '../utils/mcdm';
import dssService, { buildDecisionRows, DssCriterion, RankingOptions } from './dss.service';

const logger = createScopedLogger('service:dss-analysis');

const DEFAULT_DELTAS = [-0.2, -0.1, 0.1, 0.2];
const DEFAULT_TOP_K = 10;

export type StabilityLabel = 'stabil' | 'cukup stabil' | 'sensitif';

export interface SensitivityScenario {
  delta: number;
  adjustedWeight: number;
  spearman: number;
  kendall: number;
  topKOverlap: number;
  rankOneChanged: boolean;
}

export interface SensitivityCriterionReport {
  id: string;
  name: string;
  baseWeight: number;
  scenarios: SensitivityScenario[];
  meanSpearman: number;
  minSpearman: number;
  minTopKOverlap: number;
  rankOneChanges: number;
  stability: StabilityLabel;
}

export interface SensitivityResult {
  assetType: string;
  generatedAt: string;
  totalAlternatives: number;
  topK: number;
  deltas: number[];
  criteria: SensitivityCriterionReport[];
  baselineTop: Array<{ rank: number; detailName: string; detailCode: string; preferenceScore: number }>;
  mostSensitiveCriterionId: string | null;
  overallMinSpearman: number;
  overallStability: StabilityLabel;
  interpretation: string;
}

export interface MethodComparisonResult {
  assetType: string;
  generatedAt: string;
  totalAlternatives: number;
  topK: number;
  criteria: DssCriterion[];
  methods: Array<{
    id: 'topsis' | 'saw' | 'wp';
    name: string;
    top: Array<{ rank: number; detailName: string; detailCode: string; score: number }>;
  }>;
  agreements: Array<{
    methodA: string;
    methodB: string;
    spearman: number;
    kendall: number;
    topKOverlap: number;
  }>;
  interpretation: string;
}

export interface AnalysisOptions extends Pick<RankingOptions, 'assetType' | 'weights' | 'pairwiseMatrix'> {
  deltas?: number[];
  topK?: number;
}

/** Satu skenario pembobotan yang akan dihitung ulang lalu dibandingkan. */
export interface ScenarioInput {
  label: string;
  weights: Record<string, number>;
}

export interface ScenarioComparisonResult {
  assetType: string;
  generatedAt: string;
  totalAlternatives: number;
  topK: number;
  scenarios: Array<{ label: string; criteria: DssCriterion[] }>;
  spearman: number;
  kendall: number;
  topKOverlap: number;
  summary: {
    enteredTopK: number;
    leftTopK: number;
    unchanged: number;
    biggestMove: number;
  };
  movements: Array<{
    detailName: string;
    detailCode: string;
    rankA: number;
    rankB: number;
    delta: number;
    scoreA: number;
    scoreB: number;
    inTopKA: boolean;
    inTopKB: boolean;
  }>;
  interpretation: string;
}

const round = (value: number, digits = 4): number => {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
};

const labelStability = (minSpearman: number): StabilityLabel => {
  if (minSpearman >= 0.95) return 'stabil';
  if (minSpearman >= 0.85) return 'cukup stabil';
  return 'sensitif';
};

/**
 * Menggeser bobot satu kriteria sebesar `delta` (relatif terhadap bobot
 * awalnya), lalu menormalkan ulang seluruh bobot agar totalnya tetap 1.
 * Bobot kriteria lain ikut menyusut/membesar secara proporsional, sehingga
 * yang diuji benar-benar perubahan kepentingan relatif satu kriteria.
 */
export const perturbWeights = (
  criteria: DssCriterion[],
  criterionId: string,
  delta: number
): McdmCriterion[] => {
  const adjusted = criteria.map((criterion) => ({
    ...criterion,
    weight: criterion.id === criterionId
      ? Math.max(0, criterion.weight * (1 + delta))
      : criterion.weight,
  }));

  const total = adjusted.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (!(total > 0)) return criteria as McdmCriterion[];
  return adjusted.map((criterion) => ({ ...criterion, weight: criterion.weight / total }));
};

export class DssAnalysisService {
  private async buildContext(options: AnalysisOptions) {
    const assetType = options.assetType || 'all';
    const { criteria } = dssService.resolveCriteria(options);
    const alternatives = await dssService.loadAlternatives(assetType);
    const rows = buildDecisionRows(alternatives, criteria);
    return { assetType, criteria, alternatives, rows };
  }

  /**
   * Uji sensitivitas bobot: setiap kriteria digeser +-delta, ranking dihitung
   * ulang, lalu dibandingkan dengan ranking dasar memakai korelasi peringkat
   * Spearman/Kendall dan irisan top-K. Kriteria dengan korelasi terendah
   * adalah titik paling rawan dari model pembobotan yang sedang dipakai.
   */
  async analyzeWeightSensitivity(options: AnalysisOptions = {}): Promise<SensitivityResult> {
    const { assetType, criteria, alternatives, rows } = await this.buildContext(options);
    const topK = Math.max(1, Math.min(Number(options.topK) || DEFAULT_TOP_K, 50));
    const deltas = (Array.isArray(options.deltas) && options.deltas.length > 0 ? options.deltas : DEFAULT_DELTAS)
      .map((delta) => Number(delta))
      .filter((delta) => Number.isFinite(delta) && delta !== 0 && Math.abs(delta) <= 1);

    if (alternatives.length === 0) {
      return {
        assetType,
        generatedAt: new Date().toISOString(),
        totalAlternatives: 0,
        topK,
        deltas,
        criteria: [],
        baselineTop: [],
        mostSensitiveCriterionId: null,
        overallMinSpearman: 0,
        overallStability: 'stabil',
        interpretation: 'Belum ada data alternatif untuk diuji.',
      };
    }

    const baseline = runTopsis(rows, criteria as McdmCriterion[]);
    const baselineScores = baseline.scores;
    const baselineOrder = baselineScores
      .map((score, index) => ({ score, index }))
      .sort((left, right) => right.score - left.score);
    const baselineTopIndex = baselineOrder[0]?.index ?? -1;

    const reports: SensitivityCriterionReport[] = criteria.map((criterion) => {
      const scenarios: SensitivityScenario[] = deltas.map((delta) => {
        const perturbed = perturbWeights(criteria, criterion.id, delta);
        const scores = runTopsis(rows, perturbed).scores;
        const topIndex = scores
          .map((score, index) => ({ score, index }))
          .sort((left, right) => right.score - left.score)[0]?.index ?? -1;

        return {
          delta,
          adjustedWeight: round(perturbed.find((entry) => entry.id === criterion.id)?.weight ?? criterion.weight),
          spearman: round(spearmanRho(baselineScores, scores)),
          kendall: round(kendallTau(baselineScores, scores)),
          topKOverlap: round(topKOverlapRatio(baselineScores, scores, topK)),
          rankOneChanged: topIndex !== baselineTopIndex,
        };
      });

      const spearmanValues = scenarios.map((scenario) => scenario.spearman);
      const minSpearman = spearmanValues.length > 0 ? Math.min(...spearmanValues) : 1;

      return {
        id: criterion.id,
        name: criterion.name,
        baseWeight: round(criterion.weight),
        scenarios,
        meanSpearman: round(spearmanValues.reduce((sum, value) => sum + value, 0) / (spearmanValues.length || 1)),
        minSpearman: round(minSpearman),
        minTopKOverlap: round(scenarios.length > 0 ? Math.min(...scenarios.map((scenario) => scenario.topKOverlap)) : 1),
        rankOneChanges: scenarios.filter((scenario) => scenario.rankOneChanged).length,
        stability: labelStability(minSpearman),
      };
    });

    const overallMinSpearman = reports.length > 0 ? Math.min(...reports.map((report) => report.minSpearman)) : 1;
    const mostSensitive = reports.reduce<SensitivityCriterionReport | null>((worst, report) => {
      if (!worst) return report;
      return report.minSpearman < worst.minSpearman ? report : worst;
    }, null);
    const overallStability = labelStability(overallMinSpearman);

    const baselineTop = baselineOrder.slice(0, topK).map((entry, index) => ({
      rank: index + 1,
      detailName: alternatives[entry.index].detailName,
      detailCode: alternatives[entry.index].detailCode,
      preferenceScore: round(entry.score, 6),
    }));

    const interpretation = mostSensitive
      ? `Peringkat tergolong ${overallStability} terhadap perubahan bobot (Spearman terendah ${round(overallMinSpearman, 3)}). ` +
        `Kriteria paling berpengaruh: ${mostSensitive.name}.`
      : 'Tidak ada kriteria yang dapat diuji.';

    logger.info('DSS sensitivity analysis completed', {
      assetType,
      totalAlternatives: alternatives.length,
      overallMinSpearman,
    });

    return {
      assetType,
      generatedAt: new Date().toISOString(),
      totalAlternatives: alternatives.length,
      topK,
      deltas,
      criteria: reports,
      baselineTop,
      mostSensitiveCriterionId: mostSensitive?.id ?? null,
      overallMinSpearman: round(overallMinSpearman),
      overallStability,
      interpretation,
    };
  }

  /**
   * Membandingkan dua skenario pembobotan pada dataset yang sama.
   *
   * Kedua skenario selalu dihitung ulang penuh dari bobotnya, bukan diambil dari
   * ringkasan top-10 yang tersimpan di riwayat. Kalau membandingkan dua daftar
   * top-10 saja, alternatif yang keluar-masuk sepuluh besar tidak akan terlihat.
   */
  async compareScenarios(
    scenarioA: ScenarioInput,
    scenarioB: ScenarioInput,
    options: Pick<AnalysisOptions, 'assetType' | 'topK'> = {}
  ): Promise<ScenarioComparisonResult> {
    const assetType = options.assetType || 'all';
    const topK = Math.max(1, Math.min(Number(options.topK) || DEFAULT_TOP_K, 50));
    const criteriaA = dssService.resolveCriteria({ weights: scenarioA.weights }).criteria;
    const criteriaB = dssService.resolveCriteria({ weights: scenarioB.weights }).criteria;
    const alternatives = await dssService.loadAlternatives(assetType);

    if (alternatives.length === 0) {
      return {
        assetType,
        generatedAt: new Date().toISOString(),
        totalAlternatives: 0,
        topK,
        scenarios: [
          { label: scenarioA.label, criteria: criteriaA },
          { label: scenarioB.label, criteria: criteriaB },
        ],
        spearman: 0,
        kendall: 0,
        topKOverlap: 0,
        summary: { enteredTopK: 0, leftTopK: 0, unchanged: 0, biggestMove: 0 },
        movements: [],
        interpretation: 'Belum ada data alternatif untuk dibandingkan.',
      };
    }

    // Matriks keputusan dibangun sekali: penskalaan kuintil bergantung pada
    // dataset, bukan pada bobot, jadi kedua skenario wajib memakai matriks yang
    // sama agar perbedaannya murni berasal dari bobot.
    const rows = buildDecisionRows(alternatives, criteriaA);
    const scoresA = runTopsis(rows, criteriaA as McdmCriterion[]).scores;
    const scoresB = runTopsis(rows, criteriaB as McdmCriterion[]).scores;

    const rankOf = (scores: number[]): number[] => {
      const ranks = new Array<number>(scores.length).fill(0);
      scores
        .map((score, index) => ({ score, index }))
        .sort((left, right) => right.score - left.score)
        .forEach((entry, position) => {
          ranks[entry.index] = position + 1;
        });
      return ranks;
    };

    const ranksA = rankOf(scoresA);
    const ranksB = rankOf(scoresB);

    const movements = alternatives
      .map((alternative, index) => ({
        detailName: alternative.detailName,
        detailCode: alternative.detailCode,
        rankA: ranksA[index],
        rankB: ranksB[index],
        delta: ranksA[index] - ranksB[index],
        scoreA: round(scoresA[index], 6),
        scoreB: round(scoresB[index], 6),
        inTopKA: ranksA[index] <= topK,
        inTopKB: ranksB[index] <= topK,
      }))
      // Hanya alternatif yang muncul di top-K salah satu skenario yang relevan
      // ditindaklanjuti; sisanya hanya menambah panjang tabel.
      .filter((movement) => movement.inTopKA || movement.inTopKB)
      .sort((left, right) => Math.min(left.rankA, left.rankB) - Math.min(right.rankA, right.rankB));

    const summary = {
      enteredTopK: movements.filter((movement) => !movement.inTopKA && movement.inTopKB).length,
      leftTopK: movements.filter((movement) => movement.inTopKA && !movement.inTopKB).length,
      unchanged: movements.filter((movement) => movement.delta === 0).length,
      biggestMove: movements.reduce((max, movement) => Math.max(max, Math.abs(movement.delta)), 0),
    };

    const spearman = round(spearmanRho(scoresA, scoresB));
    const interpretation = summary.enteredTopK === 0 && summary.leftTopK === 0
      ? `Kedua skenario menghasilkan sepuluh besar yang sama (Spearman ${round(spearman, 3)}); perbedaan bobot hanya menggeser urutan di dalamnya.`
      : `${summary.enteredTopK} alternatif masuk dan ${summary.leftTopK} keluar dari top-${topK} (Spearman ${round(spearman, 3)}); perbedaan bobot mengubah daftar prioritas yang ditindaklanjuti.`;

    return {
      assetType,
      generatedAt: new Date().toISOString(),
      totalAlternatives: alternatives.length,
      topK,
      scenarios: [
        { label: scenarioA.label, criteria: criteriaA },
        { label: scenarioB.label, criteria: criteriaB },
      ],
      spearman,
      kendall: round(kendallTau(scoresA, scoresB)),
      topKOverlap: round(topKOverlapRatio(scoresA, scoresB, topK)),
      summary,
      movements,
      interpretation,
    };
  }

  /**
   * Membandingkan hasil TOPSIS dengan SAW dan WP di atas matriks keputusan dan
   * bobot yang sama. Kesepakatan tinggi antar metode menjadi bukti bahwa
   * prioritas yang keluar bukan artefak dari satu metode tertentu.
   */
  async compareMethods(options: AnalysisOptions = {}): Promise<MethodComparisonResult> {
    const { assetType, criteria, alternatives, rows } = await this.buildContext(options);
    const topK = Math.max(1, Math.min(Number(options.topK) || DEFAULT_TOP_K, 50));

    if (alternatives.length === 0) {
      return {
        assetType,
        generatedAt: new Date().toISOString(),
        totalAlternatives: 0,
        topK,
        criteria,
        methods: [],
        agreements: [],
        interpretation: 'Belum ada data alternatif untuk dibandingkan.',
      };
    }

    const mcdmCriteria = criteria as McdmCriterion[];
    const scoresByMethod: Record<'topsis' | 'saw' | 'wp', number[]> = {
      topsis: runTopsis(rows, mcdmCriteria).scores,
      saw: runSaw(rows, mcdmCriteria),
      wp: runWp(rows, mcdmCriteria),
    };

    const methodNames: Record<'topsis' | 'saw' | 'wp', string> = {
      topsis: 'TOPSIS',
      saw: 'SAW (Simple Additive Weighting)',
      wp: 'WP (Weighted Product)',
    };

    const methods = (Object.keys(scoresByMethod) as Array<'topsis' | 'saw' | 'wp'>).map((methodId) => ({
      id: methodId,
      name: methodNames[methodId],
      top: scoresByMethod[methodId]
        .map((score, index) => ({ score, index }))
        .sort((left, right) => right.score - left.score)
        .slice(0, topK)
        .map((entry, position) => ({
          rank: position + 1,
          detailName: alternatives[entry.index].detailName,
          detailCode: alternatives[entry.index].detailCode,
          score: round(entry.score, 6),
        })),
    }));

    const pairs: Array<['topsis' | 'saw' | 'wp', 'topsis' | 'saw' | 'wp']> = [
      ['topsis', 'saw'],
      ['topsis', 'wp'],
      ['saw', 'wp'],
    ];
    const agreements = pairs.map(([methodA, methodB]) => ({
      methodA: methodNames[methodA],
      methodB: methodNames[methodB],
      spearman: round(spearmanRho(scoresByMethod[methodA], scoresByMethod[methodB])),
      kendall: round(kendallTau(scoresByMethod[methodA], scoresByMethod[methodB])),
      topKOverlap: round(topKOverlapRatio(scoresByMethod[methodA], scoresByMethod[methodB], topK)),
    }));

    const topsisAgreements = agreements.filter((agreement) => agreement.methodA === methodNames.topsis);
    const minAgreement = topsisAgreements.length > 0
      ? Math.min(...topsisAgreements.map((agreement) => agreement.spearman))
      : 1;
    const interpretation = minAgreement >= 0.9
      ? `Ranking TOPSIS konsisten dengan SAW dan WP (Spearman terendah ${round(minAgreement, 3)}), sehingga prioritas tidak bergantung pada satu metode saja.`
      : `Ranking TOPSIS berbeda cukup jauh dari metode pembanding (Spearman terendah ${round(minAgreement, 3)}); periksa kembali bobot dan skala kriteria.`;

    return {
      assetType,
      generatedAt: new Date().toISOString(),
      totalAlternatives: alternatives.length,
      topK,
      criteria,
      methods,
      agreements,
      interpretation,
    };
  }
}

export const dssAnalysisService = new DssAnalysisService();
export default dssAnalysisService;
