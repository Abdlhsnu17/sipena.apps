import ExcelJS from 'exceljs';
import { ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { generateAssetCode } from '../utils/helpers';
import { ensureNonMedicalConditionColumn, ensureNonMedicalSpecificationsColumn } from '../utils/schema';

export interface ImportRow {
  rowIndex: number;
  name: string;
  category: string;
  assetCode?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  location?: string;
  status?: string;
  condition?: string;
  usagePurpose?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
  inserted: number[];
}

const statusMap: Record<string, string> = {
  tersedia: 'available',
  available: 'available',
  dipinjam: 'borrowed',
  borrowed: 'borrowed',
  pemeliharaan: 'maintenance',
  'dalam pemeliharaan': 'maintenance',
  'dalam perbaikan': 'maintenance',
  'dalam kalibrasi': 'maintenance',
  'dalam inspeksi': 'maintenance',
  maintenance: 'maintenance',
  'nonaktif': 'disposed',
  'non-aktif': 'disposed',
  dihapus: 'disposed',
  disposed: 'disposed',
};

const conditionMap: Record<string, string> = {
  baik: 'good',
  good: 'good',
  cukup: 'fair',
  fair: 'fair',
  rusak: 'damaged',
  damaged: 'damaged',
  buruk: 'poor',
  poor: 'poor',
};

const normalizeStatus = (v?: string) =>
  statusMap[(v ?? '').toLowerCase().trim()] ?? 'available';

const normalizeCondition = (v?: string) =>
  conditionMap[(v ?? '').toLowerCase().trim()] ?? 'good';

const normalizeImportHeader = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '');

const statusLabelMap: Record<string, string> = {
  available: 'Tersedia',
  borrowed: 'Dipinjam',
  maintenance: 'Dalam Perbaikan',
  disposed: 'Nonaktif',
};

const conditionLabelMap: Record<string, string> = {
  good: 'Baik',
  fair: 'Cukup',
  poor: 'Rusak',
  damaged: 'Rusak',
};

const normalizeDate = (v: any): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const buildMedicalSpecifications = (row: ImportRow, code: string, status: string, condition: string) => ({
  details: [
    {
      id: row.serialNumber || code,
      assetCode: code,
      inventoryName: row.name,
      type: row.category,
      name: row.brand || '',
      brand: row.brand || '',
      model: row.model || '',
      brandModel: [row.brand, row.model].filter(Boolean).join(' / '),
      serialNumber: row.serialNumber || '',
      purchaseDate: normalizeDate(row.purchaseDate) || '',
      condition: conditionLabelMap[condition] || 'Baik',
      status: statusLabelMap[status] || 'Tersedia',
      notes: '',
      usagePurpose: row.usagePurpose || 'Operasional Bersama',
      roomId: row.location || '',
    },
  ],
});

type ExcelJsLoadBuffer = Parameters<ExcelJS.Workbook['xlsx']['load']>[0];

export const parseWorksheet = (ws: ExcelJS.Worksheet): ImportRow[] => {
  const rows: ImportRow[] = [];
  let headerRow: number | null = null;
  let headers: string[] = [];

  ws.eachRow((row, rowNum) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1).map((v) =>
      v instanceof Object && 'text' in (v as any) ? String((v as any).text) : v == null ? '' : String(v).trim()
    );

    if (headerRow === null) {
      const lower = values.map(normalizeImportHeader);
      if (lower.some((value) => ['nama', 'name', 'namaset', 'namaaset'].includes(value))) {
        headerRow = rowNum;
        headers = lower;
      }
      return;
    }

    const get = (keys: string[]): string => {
      const normalizedKeys = keys.map(normalizeImportHeader);
      for (const key of keys) {
        const normalizedKey = normalizeImportHeader(key);
        const idx = headers.findIndex(
          (header) => header === normalizedKey || header.includes(normalizedKey) || normalizedKey.includes(header)
        );
        if (idx >= 0 && values[idx]) return String(values[idx]).trim();
      }
      for (const normalizedKey of normalizedKeys) {
        const idx = headers.findIndex(
          (header) => header === normalizedKey || header.includes(normalizedKey) || normalizedKey.includes(header)
        );
        if (idx >= 0 && values[idx]) return String(values[idx]).trim();
      }
      return '';
    };

    const name = get(['nama', 'name', 'nama_aset']);
    const category = get(['kategori', 'category', 'tipe', 'type']);
    if (!name) return;

    rows.push({
      rowIndex: rowNum,
      name,
      category: category || 'Umum',
      assetCode: get(['kode_aset', 'kode', 'asset_code', 'code']) || undefined,
      brand: get(['merek', 'brand', 'merk']) || undefined,
      model: get(['model', 'tipe']) || undefined,
      serialNumber: get(['serial_number', 'nomor_seri', 'sn']) || undefined,
      purchaseDate: get(['tanggal_pembelian', 'purchase_date', 'tgl_beli']) || undefined,
      warrantyExpiry: get(['garansi', 'warranty_expiry', 'warranty']) || undefined,
      location: get(['lokasi', 'location', 'ruangan']) || undefined,
      status: get(['status']) || undefined,
      condition: get(['kondisi', 'condition']) || undefined,
      usagePurpose: get(['keperluan', 'usage_purpose', 'tujuan']) || undefined,
    });
  });

  return rows;
};

export async function importAssetsFromBuffer(
  buffer: Uint8Array,
  assetType: 'medical' | 'non_medical',
  createdBy: number
): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJsLoadBuffer);

  const ws = workbook.worksheets[0];
  if (!ws) throw new Error('File tidak memiliki worksheet');

  const rows = parseWorksheet(ws);
  if (rows.length === 0) throw new Error('Tidak ada baris data yang valid ditemukan. Pastikan baris pertama berisi header.');

  const result: ImportResult = { success: 0, failed: 0, errors: [], inserted: [] };
  const table = assetType === 'non_medical' ? 'non_medical_assets' : 'medical_assets';
  const umbrellaCategory = assetType === 'medical' ? 'Medis' : 'Non Medis';

  if (assetType === 'non_medical') {
    await ensureNonMedicalSpecificationsColumn();
    await ensureNonMedicalConditionColumn();
  }

  for (const row of rows) {
    try {
      const code = row.assetCode || generateAssetCode(assetType);
      const status = normalizeStatus(row.status);
      const condition = normalizeCondition(row.condition);
      const purchaseDate = normalizeDate(row.purchaseDate);
      const warrantyExpiry = normalizeDate(row.warrantyExpiry);

      if (assetType === 'non_medical') {
        const fields = ['asset_code', 'name', 'category', 'status', '`condition`', 'created_by'];
        const values: any[] = [code, row.name, umbrellaCategory, status, condition, createdBy];

        if (row.brand) { fields.push('brand'); values.push(row.brand); }
        if (row.model) { fields.push('model'); values.push(row.model); }
        if (row.serialNumber) { fields.push('serial_number'); values.push(row.serialNumber); }
        if (purchaseDate) { fields.push('purchase_date'); values.push(purchaseDate); }
        if (warrantyExpiry) { fields.push('warranty_expiry'); values.push(warrantyExpiry); }
        if (row.location) { fields.push('location'); values.push(row.location); }
        if (row.usagePurpose) { fields.push('usage_purpose'); values.push(row.usagePurpose); }

        const [res] = await pool.query<ResultSetHeader>(
          `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
          values
        );
        result.inserted.push(res.insertId);
      } else {
        const fields = [
          'asset_code',
          'name',
          'category',
          'type',
          'status',
          '`condition`',
          'location',
          'purchase_date',
          'warranty_expiry',
          'specifications',
        ];
        const values: any[] = [
          code,
          row.location || row.name,
          umbrellaCategory,
          'medical',
          status,
          condition,
          row.location || null,
          purchaseDate,
          warrantyExpiry,
          JSON.stringify(buildMedicalSpecifications(row, code, status, condition)),
        ];

        const [res] = await pool.query<ResultSetHeader>(
          `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
          values
        );
        result.inserted.push(res.insertId);
      }
      result.success++;
    } catch (err: any) {
      result.failed++;
      result.errors.push({ row: row.rowIndex, message: err?.message ?? 'Gagal menyimpan baris' });
    }
  }

  return result;
}

export function generateImportTemplate(assetType: 'medical' | 'non_medical'): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Template Import Aset');

  const headers = [
    { header: 'Nama Aset *', key: 'nama', width: 30 },
    { header: 'Tipe Detail *', key: 'kategori', width: 25 },
    { header: 'Kode Aset', key: 'kode_aset', width: 20 },
    { header: 'Merek', key: 'merek', width: 20 },
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Serial Number', key: 'serial_number', width: 20 },
    { header: 'Tanggal Pembelian', key: 'tanggal_pembelian', width: 20 },
    { header: 'Garansi', key: 'garansi', width: 20 },
    { header: 'Lokasi', key: 'lokasi', width: 25 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Kondisi', key: 'kondisi', width: 15 },
    { header: 'Keperluan', key: 'keperluan', width: 25 },
  ];

  ws.columns = headers;

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
  headerRow.commit();

  const exampleCategories = assetType === 'medical'
    ? ['Alat Gawat Darurat', 'Alat Diagnostik dan Pencitraan', 'Alat Laboratorium Medis']
    : ['IT dan Komunikasi', 'HVAC dan Tata Udara', 'Keamanan dan Akses'];

  ws.addRow([
    'Contoh Nama Aset',
    exampleCategories[0],
    '',
    'ABC Corp',
    'Model X',
    'SN-001',
    '2024-01-01',
    '2027-01-01',
    'Ruang Perawatan A',
    'tersedia',
    'baik',
    'Operasional',
  ]);

  const noteWs = wb.addWorksheet('Panduan');
  noteWs.addRow(['Kolom', 'Keterangan', 'Nilai yang Valid']);
  noteWs.addRow(['Nama Aset *', 'Wajib diisi', '']);
  noteWs.addRow(['Tipe Detail *', 'Wajib diisi (kategori ruangan otomatis diset Medis/Non Medis)', exampleCategories.join(', ')]);
  noteWs.addRow(['Status', 'Opsional', 'tersedia, dipinjam, pemeliharaan, dihapus']);
  noteWs.addRow(['Kondisi', 'Opsional', 'baik, cukup, buruk, rusak']);
  noteWs.addRow(['Tanggal', 'Format', 'YYYY-MM-DD']);
  noteWs.columns = [{ width: 22 }, { width: 35 }, { width: 40 }];
  const noteHeader = noteWs.getRow(1);
  noteHeader.font = { bold: true };
  noteHeader.commit();

  return wb;
}
