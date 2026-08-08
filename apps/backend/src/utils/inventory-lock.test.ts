import { describe, expect, it } from 'vitest';
import {
  buildInventoryLockKeys,
  getAssetFallbackDetailIds,
  isAssetFallbackDetailId,
  normalizeDetailIdentifier,
  normalizeLockAssetType,
} from './inventory-lock';

describe('normalizeLockAssetType', () => {
  it('hanya mengenali non_medical, selebihnya dianggap medical', () => {
    expect(normalizeLockAssetType('non_medical')).toBe('non_medical');
    expect(normalizeLockAssetType('medical')).toBe('medical');
    expect(normalizeLockAssetType(null)).toBe('medical');
    expect(normalizeLockAssetType('apa pun')).toBe('medical');
  });
});

describe('normalizeDetailIdentifier', () => {
  it('memangkas spasi dan mengubah nilai kosong menjadi string kosong', () => {
    expect(normalizeDetailIdentifier('  det-1 ')).toBe('det-1');
    expect(normalizeDetailIdentifier(null)).toBe('');
    expect(normalizeDetailIdentifier(undefined)).toBe('');
    expect(normalizeDetailIdentifier(12)).toBe('12');
  });
});

describe('isAssetFallbackDetailId', () => {
  it('mengenali kedua bentuk id detail semu', () => {
    expect(getAssetFallbackDetailIds(7, 'medical')).toEqual(['asset-7', 'asset-medical-7']);
    expect(isAssetFallbackDetailId('asset-7', 7, 'medical')).toBe(true);
    expect(isAssetFallbackDetailId('asset-medical-7', 7, 'medical')).toBe(true);
    expect(isAssetFallbackDetailId('asset-non_medical-7', 7, 'non_medical')).toBe(true);
  });

  it('tidak menganggap id detail sungguhan sebagai semu', () => {
    expect(isAssetFallbackDetailId('det-abc', 7, 'medical')).toBe(false);
    expect(isAssetFallbackDetailId('asset-8', 7, 'medical')).toBe(false);
    expect(isAssetFallbackDetailId('', 7, 'medical')).toBe(false);
  });
});

describe('buildInventoryLockKeys', () => {
  it('mengunci seluruh aset ketika tidak ada detail spesifik', () => {
    const keys = buildInventoryLockKeys([{ assetId: 3, assetType: 'medical', assetDetailId: null }]);

    expect(keys.assetLocks).toEqual(['medical|3']);
    expect(keys.detailLocks).toEqual([]);
  });

  it('mengunci seluruh aset ketika detail-nya hanya id semu', () => {
    const keys = buildInventoryLockKeys([
      { assetId: 3, assetType: 'medical', assetDetailId: 'asset-3' },
      { assetId: 4, assetType: 'non_medical', assetDetailId: 'asset-non_medical-4' },
    ]);

    expect(keys.assetLocks.sort()).toEqual(['medical|3', 'non_medical|4']);
    expect(keys.detailLocks).toEqual([]);
  });

  it('mengunci pada tingkat detail ketika detailnya spesifik', () => {
    const keys = buildInventoryLockKeys([
      { assetId: 5, assetType: 'non_medical', assetDetailId: 'det-9' },
    ]);

    expect(keys.detailLocks).toEqual(['non_medical|5|det-9']);
    expect(keys.assetLocks).toEqual([]);
  });

  it('menghilangkan duplikat kunci', () => {
    const keys = buildInventoryLockKeys([
      { assetId: 3, assetType: 'medical', assetDetailId: null },
      { assetId: 3, assetType: 'medical', assetDetailId: null },
      { assetId: 3, assetType: 'medical', assetDetailId: 'det-1' },
      { assetId: 3, assetType: 'medical', assetDetailId: 'det-1' },
    ]);

    expect(keys.assetLocks).toEqual(['medical|3']);
    expect(keys.detailLocks).toEqual(['medical|3|det-1']);
  });

  it('menganggap asset_type yang tidak dikenal sebagai medical, seperti di frontend', () => {
    const keys = buildInventoryLockKeys([{ assetId: 6, assetType: null, assetDetailId: null }]);

    expect(keys.assetLocks).toEqual(['medical|6']);
  });

  it('mengabaikan baris dengan asset id tidak valid', () => {
    const keys = buildInventoryLockKeys([
      { assetId: 0, assetType: 'medical', assetDetailId: null },
      { assetId: Number.NaN, assetType: 'medical', assetDetailId: 'det-1' },
      { assetId: -2, assetType: 'medical', assetDetailId: null },
    ]);

    expect(keys.assetLocks).toEqual([]);
    expect(keys.detailLocks).toEqual([]);
  });

  it('memangkas spasi pada id detail agar kunci tetap cocok', () => {
    const keys = buildInventoryLockKeys([
      { assetId: 2, assetType: 'medical', assetDetailId: '  det-7  ' },
    ]);

    expect(keys.detailLocks).toEqual(['medical|2|det-7']);
  });
});
