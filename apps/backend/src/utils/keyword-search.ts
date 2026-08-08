/**
 * Membangun kondisi SQL pencarian kata kunci yang meniru perilaku
 * `matchesSearchKeyword` di frontend, supaya pencarian bisa dijalankan di
 * database (memakai index dan pagination) tanpa mengubah hasil yang dilihat
 * pengguna.
 *
 * Aturan yang ditiru:
 * 1. Cocok bila salah satu kolom memuat seluruh kata kunci (pencocokan frasa).
 * 2. Bila tidak, cocok bila SETIAP token kata kunci ditemukan di salah satu
 *    kolom — token yang berbeda boleh berasal dari kolom yang berbeda.
 * 3. Selain pencocokan mentah, ada pencocokan "padat" yang mengabaikan tanda
 *    baca: "PMJ-00012" tetap cocok dengan pencarian "pmj 00012".
 * 4. Prefiks label hasil pindai QR ("no id:", "nama:", "kode:", "sn:",
 *    "lokasi:", "sumber:") diabaikan.
 *
 * Perbedaan yang diketahui: penyamaan huruf besar/kecil dan aksen mengandalkan
 * collation database (utf8mb4_unicode_ci), sedangkan frontend menormalkan aksen
 * lewat NFKD. Untuk pencocokan padat, aksen dihapus oleh REGEXP_REPLACE di SQL
 * ("café" → "caf") sementara frontend mengubahnya ke huruf dasar ("cafe").
 * Data operasional SIPENA berbahasa Indonesia tanpa diakritik, sehingga selisih
 * ini tidak terlihat; lihat keyword-search.test.ts.
 */

export interface KeywordSearchCondition {
  /** Kondisi SQL yang sudah dibungkus tanda kurung, siap disambung dengan AND. */
  sql: string;
  params: string[];
}

/** Menghapus tanda baca dan spasi, menyisakan huruf dan angka. */
const toCompactToken = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Prefiks label yang muncul pada hasil pindai QR/barcode. */
const stripQrLabels = (keyword: string): string =>
  keyword
    .replace(/\b(no\s*id|nama|kode|sn|lokasi|sumber)\s*:/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildKeywordVariants = (keyword: string): string[] => {
  const variants = new Set<string>([keyword]);
  const withoutLabels = stripQrLabels(keyword);
  if (withoutLabels) {
    variants.add(withoutLabels);
  }
  return Array.from(variants);
};

/** Ekspresi SQL yang memadatkan sebuah kolom agar bisa dibandingkan tanpa tanda baca. */
const compactExpression = (column: string): string =>
  `REGEXP_REPLACE(LOWER(COALESCE(${column}, '')), '[^a-z0-9]', '')`;

const escapeLikeValue = (value: string): string =>
  value.replace(/[\\%_]/g, (match) => `\\${match}`);

/**
 * @param keyword kata kunci mentah dari pengguna
 * @param columns ekspresi kolom SQL yang boleh dicari (mis. `b.borrowing_code`,
 *   `COALESCE(ma.name, na.name)`, atau ekspresi turunan)
 * @returns null bila kata kunci kosong, artinya tidak ada penyaringan
 */
export const buildKeywordSearchCondition = (
  keyword: string | null | undefined,
  columns: string[]
): KeywordSearchCondition | null => {
  const trimmed = (keyword ?? '').trim();
  if (!trimmed || columns.length === 0) {
    return null;
  }

  const params: string[] = [];

  // Satu nilai cocok bila kolom mentahnya memuat teks, ATAU bentuk padatnya
  // memuat versi padat teks tersebut.
  const matchAnyColumn = (value: string): string => {
    const parts: string[] = [];

    for (const column of columns) {
      parts.push(`COALESCE(${column}, '') LIKE ?`);
      params.push(`%${escapeLikeValue(value)}%`);
    }

    const compactValue = toCompactToken(value);
    if (compactValue) {
      for (const column of columns) {
        parts.push(`${compactExpression(column)} LIKE ?`);
        params.push(`%${escapeLikeValue(compactValue)}%`);
      }
    }

    return `(${parts.join(' OR ')})`;
  };

  const variantConditions = buildKeywordVariants(trimmed).map((variant) => {
    const phraseCondition = matchAnyColumn(variant);
    const tokens = variant.split(/\s+/).filter(Boolean);

    // Token tunggal sudah tercakup oleh pencocokan frasa.
    if (tokens.length <= 1) {
      return phraseCondition;
    }

    const everyTokenCondition = tokens.map((token) => matchAnyColumn(token)).join(' AND ');
    return `(${phraseCondition} OR (${everyTokenCondition}))`;
  });

  return {
    sql: `(${variantConditions.join(' OR ')})`,
    params,
  };
};

/**
 * Ekspresi SQL untuk "No ID" yang ditampilkan di tabel.
 *
 * Meniru formatNoId di frontend: bila kode eksplisit ada, itulah yang dipakai;
 * bila tidak, dibentuk dari prefiks modul dan id yang dipad 5 digit
 * (mis. `PMJ-00012`), sehingga pengguna dapat mencari lewat keduanya.
 */
export const buildRecordNoIdExpression = (
  prefix: string,
  codeColumn: string,
  idColumn: string,
  padding = 5
): string =>
  `COALESCE(NULLIF(TRIM(${codeColumn}), ''), CONCAT('${prefix}-', LPAD(${idColumn}, ${padding}, '0')))`;

/**
 * Ekspresi SQL untuk asal aset, meniru deriveAssetSource di frontend: pakai
 * asset_type bila dikenali, jika tidak jatuh ke prefiks kode aset.
 */
export const buildAssetSourceExpression = (
  assetTypeColumn: string,
  assetCodeColumn: string
): string => `
  CASE
    WHEN LOWER(REPLACE(COALESCE(${assetTypeColumn}, ''), '-', '_')) IN ('medical', 'medis') THEN 'medis'
    WHEN LOWER(REPLACE(COALESCE(${assetTypeColumn}, ''), '-', '_')) IN ('non_medical', 'non_medis', 'non medis') THEN 'non_medis'
    WHEN UPPER(COALESCE(${assetCodeColumn}, '')) LIKE 'NMD%' THEN 'non_medis'
    WHEN UPPER(COALESCE(${assetCodeColumn}, '')) LIKE 'INM%' THEN 'non_medis'
    WHEN UPPER(COALESCE(${assetCodeColumn}, '')) LIKE 'MED%' THEN 'medis'
    WHEN UPPER(COALESCE(${assetCodeColumn}, '')) LIKE 'IMD%' THEN 'medis'
    ELSE 'Semua'
  END`;
