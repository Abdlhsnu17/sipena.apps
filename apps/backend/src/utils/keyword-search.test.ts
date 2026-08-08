import { describe, expect, it } from 'vitest';
import {
  buildAssetSourceExpression,
  buildKeywordSearchCondition,
  buildRecordNoIdExpression,
} from './keyword-search';

const COLUMNS = ['b.borrowing_code', 'u.name'];

describe('buildKeywordSearchCondition', () => {
  it('tidak menyaring apa pun untuk kata kunci kosong', () => {
    expect(buildKeywordSearchCondition('', COLUMNS)).toBeNull();
    expect(buildKeywordSearchCondition('   ', COLUMNS)).toBeNull();
    expect(buildKeywordSearchCondition(null, COLUMNS)).toBeNull();
    expect(buildKeywordSearchCondition(undefined, COLUMNS)).toBeNull();
  });

  it('tidak menyaring apa pun bila tidak ada kolom yang boleh dicari', () => {
    expect(buildKeywordSearchCondition('kursi', [])).toBeNull();
  });

  it('mencari kata kunci di setiap kolom, mentah maupun padat', () => {
    const result = buildKeywordSearchCondition('kursi', COLUMNS)!;

    expect(result.sql).toContain("COALESCE(b.borrowing_code, '') LIKE ?");
    expect(result.sql).toContain("COALESCE(u.name, '') LIKE ?");
    expect(result.sql).toContain('REGEXP_REPLACE');
    // 2 kolom mentah + 2 kolom padat
    expect(result.params).toEqual(['%kursi%', '%kursi%', '%kursi%', '%kursi%']);
  });

  it('mengabaikan tanda baca lewat pencocokan padat', () => {
    const result = buildKeywordSearchCondition('PMJ-00012', COLUMNS)!;

    // Nilai mentah tetap dipakai, ditambah bentuk padat tanpa tanda hubung.
    expect(result.params).toContain('%PMJ-00012%');
    expect(result.params).toContain('%pmj00012%');
  });

  it('mensyaratkan semua token cocok ketika kata kunci punya beberapa kata', () => {
    const result = buildKeywordSearchCondition('kursi roda', COLUMNS)!;

    // Ada pencocokan frasa, lalu alternatif "setiap token cocok" yang di-AND.
    expect(result.sql).toContain(' AND ');
    expect(result.sql).toContain(' OR ');
    expect(result.params).toContain('%kursi roda%');
    expect(result.params).toContain('%kursi%');
    expect(result.params).toContain('%roda%');
  });

  it('tidak membangun cabang token untuk kata kunci satu kata', () => {
    const result = buildKeywordSearchCondition('kursi', COLUMNS)!;

    expect(result.sql).not.toContain(' AND ');
  });

  it('membuang prefiks label hasil pindai QR', () => {
    const result = buildKeywordSearchCondition('No ID: IMD-001', COLUMNS)!;

    // Varian tanpa label ikut dicari agar hasil pindai QR tetap menemukan aset.
    expect(result.params).toContain('%IMD-001%');
  });

  it('meng-escape wildcard agar tidak diperlakukan sebagai pola LIKE', () => {
    const result = buildKeywordSearchCondition('100%', COLUMNS)!;

    expect(result.params).toContain('%100\\%%');
    expect(result.params.some((param) => param === '%100%%')).toBe(false);
  });

  it('meng-escape garis bawah dan backslash', () => {
    const underscore = buildKeywordSearchCondition('a_b', COLUMNS)!;
    expect(underscore.params).toContain('%a\\_b%');

    const backslash = buildKeywordSearchCondition('a\\b', COLUMNS)!;
    expect(backslash.params).toContain('%a\\\\b%');
  });

  it('menghasilkan SQL berpasangan seimbang antara placeholder dan parameter', () => {
    for (const keyword of ['kursi', 'kursi roda pasien', 'No ID: PMJ-00012', 'a-b c_d']) {
      const result = buildKeywordSearchCondition(keyword, COLUMNS)!;
      const placeholders = (result.sql.match(/\?/g) || []).length;

      expect(placeholders).toBe(result.params.length);
    }
  });

  it('membungkus kondisi dalam tanda kurung agar aman disambung dengan AND', () => {
    const result = buildKeywordSearchCondition('kursi roda', COLUMNS)!;

    expect(result.sql.startsWith('(')).toBe(true);
    expect(result.sql.endsWith(')')).toBe(true);
  });
});

describe('buildRecordNoIdExpression', () => {
  it('memakai kode eksplisit bila ada, dan pad id bila tidak', () => {
    const sql = buildRecordNoIdExpression('PMJ', 'b.borrowing_code', 'b.id');

    expect(sql).toContain("NULLIF(TRIM(b.borrowing_code), '')");
    expect(sql).toContain("CONCAT('PMJ-', LPAD(b.id, 5, '0'))");
  });

  it('menghormati panjang padding kustom', () => {
    expect(buildRecordNoIdExpression('AST', "''", 'm.asset_id', 4)).toContain("LPAD(m.asset_id, 4, '0')");
  });
});

describe('buildAssetSourceExpression', () => {
  const sql = buildAssetSourceExpression('b.asset_type', 'ma.asset_code');

  it('memetakan asset_type yang dikenali ke medis / non_medis', () => {
    expect(sql).toContain("IN ('medical', 'medis') THEN 'medis'");
    expect(sql).toContain("IN ('non_medical', 'non_medis', 'non medis') THEN 'non_medis'");
  });

  it('menormalkan tanda hubung agar "non-medical" ikut terbaca', () => {
    expect(sql).toContain("REPLACE(COALESCE(b.asset_type, ''), '-', '_')");
  });

  it('jatuh ke prefiks kode aset ketika asset_type tidak dikenali', () => {
    expect(sql).toContain("LIKE 'NMD%'");
    expect(sql).toContain("LIKE 'INM%'");
    expect(sql).toContain("LIKE 'MED%'");
    expect(sql).toContain("LIKE 'IMD%'");
    expect(sql).toContain("ELSE 'Semua'");
  });
});
