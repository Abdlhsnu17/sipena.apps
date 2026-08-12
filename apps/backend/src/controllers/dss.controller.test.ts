import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/dss.service', () => ({
  default: {
    rankAssets: vi.fn(),
    saveRankingHistory: vi.fn(),
  },
}));

vi.mock('../services/dss-analysis.service', () => ({
  default: {
    analyzeWeightSensitivity: vi.fn(),
    compareMethods: vi.fn(),
    compareScenarios: vi.fn(),
  },
}));

import dssService from '../services/dss.service';
import dssController from './dss.controller';

const mockRankAssets = dssService.rankAssets as unknown as ReturnType<typeof vi.fn>;
const mockSaveHistory = dssService.saveRankingHistory as unknown as ReturnType<typeof vi.fn>;

const buildResult = (totalAlternatives: number) => ({
  criteria: [{ id: 'condition', name: 'Kondisi Aset', type: 'benefit' as const, weight: 1 }],
  consistency: null,
  idealSolutions: { positive: {}, negative: {} },
  generatedAt: new Date().toISOString(),
  totalAlternatives,
  pagination: { limit: 100, offset: 0, returned: 0, total: totalAlternatives },
  rankings: [],
});

const buildResponse = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response & { json: ReturnType<typeof vi.fn> };
};

const buildRequest = (body: Record<string, unknown>) =>
  ({ body, user: { id: 7 } }) as unknown as Request;

describe('DssController.getRanking history persistence', () => {
  beforeEach(() => {
    mockRankAssets.mockReset();
    mockSaveHistory.mockReset();
    mockRankAssets.mockResolvedValue(buildResult(5));
  });

  it('reports historySaved true once the snapshot is persisted', async () => {
    mockSaveHistory.mockResolvedValue(undefined);
    const res = buildResponse();

    await dssController.getRanking(buildRequest({ assetType: 'all', saveHistory: true, label: 'Baseline' }), res);

    expect(mockSaveHistory).toHaveBeenCalledTimes(1);
    expect(mockSaveHistory.mock.calls[0][4]).toBe('Baseline');
    expect(res.json.mock.calls[0][0].data.historySaved).toBe(true);
  });

  it('reports historySaved false instead of silently swallowing a save failure', async () => {
    mockSaveHistory.mockRejectedValue(new Error("Unknown column 'label' in 'field list'"));
    const res = buildResponse();

    await dssController.getRanking(buildRequest({ assetType: 'all', saveHistory: true }), res);

    const payload = res.json.mock.calls[0][0];
    // Ranking tetap dikirim; hanya status penyimpanannya yang dilaporkan gagal.
    expect(payload.success).toBe(true);
    expect(payload.data.historySaved).toBe(false);
  });

  it('waits for the save before responding, so the flag reflects the real outcome', async () => {
    const order: string[] = [];
    mockSaveHistory.mockImplementation(async () => {
      order.push('save');
    });
    const res = buildResponse();
    res.json.mockImplementation(() => {
      order.push('respond');
    });

    await dssController.getRanking(buildRequest({ assetType: 'all', saveHistory: true }), res);

    expect(order).toEqual(['save', 'respond']);
  });

  it('omits the flag entirely when the caller did not ask to save', async () => {
    const res = buildResponse();

    await dssController.getRanking(buildRequest({ assetType: 'all' }), res);

    expect(mockSaveHistory).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data).not.toHaveProperty('historySaved');
  });

  it('does not persist an empty ranking and marks it as not saved', async () => {
    mockRankAssets.mockResolvedValue(buildResult(0));
    const res = buildResponse();

    await dssController.getRanking(buildRequest({ assetType: 'all', saveHistory: true }), res);

    expect(mockSaveHistory).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.historySaved).toBe(false);
  });
});
