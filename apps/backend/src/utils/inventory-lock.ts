/**
 * Kunci ketersediaan inventaris.
 *
 * Bentuk kuncinya harus persis sama dengan yang dibangun di frontend
 * (`utils/detail-inventory.ts`) karena dipakai untuk mencocokkan aset yang boleh
 * dipinjam. Dipindahkan ke server supaya halaman peminjaman tidak perlu menarik
 * seluruh peminjaman hanya untuk menghitung kunci ini.
 */

export type LockAssetType = 'medical' | 'non_medical';

export const normalizeLockAssetType = (value?: string | null): LockAssetType =>
  value === 'non_medical' ? 'non_medical' : 'medical';

export const normalizeDetailIdentifier = (value?: string | number | null): string => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

/**
 * Id detail semu yang dipakai saat sebuah aset tidak dipecah menjadi detail
 * inventaris. Nilai seperti ini harus diperlakukan sebagai kunci tingkat aset.
 */
export const getAssetFallbackDetailIds = (assetId: number, assetType?: string | null): string[] => {
  const normalizedAssetType = normalizeLockAssetType(assetType);
  return [`asset-${assetId}`, `asset-${normalizedAssetType}-${assetId}`];
};

export const isAssetFallbackDetailId = (
  detailId: string | number | null | undefined,
  assetId: number,
  assetType?: string | null
): boolean => {
  const normalizedDetailId = normalizeDetailIdentifier(detailId);
  if (!normalizedDetailId) return false;
  return getAssetFallbackDetailIds(assetId, assetType).includes(normalizedDetailId);
};

export interface InventoryLockSource {
  assetId: number;
  assetType?: string | null;
  assetDetailId?: string | number | null;
}

export interface InventoryLockKeys {
  /** Kunci tingkat aset: `${assetType}|${assetId}` — mengunci seluruh aset. */
  assetLocks: string[];
  /** Kunci tingkat detail: `${assetType}|${assetId}|${detailId}`. */
  detailLocks: string[];
}

/**
 * Membangun kunci dari sekumpulan catatan yang sedang mengunci inventaris.
 * Catatan tanpa detail spesifik mengunci seluruh aset, sesuai perilaku lama di
 * halaman peminjaman.
 */
export const buildInventoryLockKeys = (records: InventoryLockSource[]): InventoryLockKeys => {
  const assetLocks = new Set<string>();
  const detailLocks = new Set<string>();

  for (const record of records) {
    const assetId = Number(record.assetId);
    if (!Number.isFinite(assetId) || assetId <= 0) continue;

    const assetType = normalizeLockAssetType(record.assetType);
    const baseLockKey = `${assetType}|${assetId}`;
    const detailId = normalizeDetailIdentifier(record.assetDetailId);

    if (!detailId || isAssetFallbackDetailId(detailId, assetId, assetType)) {
      assetLocks.add(baseLockKey);
      continue;
    }

    detailLocks.add(`${baseLockKey}|${detailId}`);
  }

  return {
    assetLocks: Array.from(assetLocks),
    detailLocks: Array.from(detailLocks),
  };
};
