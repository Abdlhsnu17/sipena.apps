import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { databaseModuleMock, onQuery, resetDatabaseMock } from '../test-support/database-mock';

vi.mock('../config/database', () => databaseModuleMock());

import { generateImportTemplate, importAssetsFromBuffer, parseWorksheet } from './asset-import.service';

describe('asset-import service', () => {
  beforeEach(() => {
    resetDatabaseMock();
  });

  it('menerima template Excel resmi yang memakai tanda * pada header', async () => {
    onQuery(/INSERT INTO medical_assets/i, { insertId: 123 });

    const workbook = generateImportTemplate('medical');
    const worksheet = workbook.getWorksheet(1) as ExcelJS.Worksheet;

    worksheet.getRow(2).values = [
      'Aset Uji',
      'Alat Diagnostik dan Pencitraan',
      'TEST-001',
      'ACME',
      'Model A',
      'SN-123',
      '2026-08-20',
      '2027-08-20',
      'Ruang Uji',
      'tersedia',
      'baik',
      'Operasional',
    ];

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const reloadedWorkbook = new ExcelJS.Workbook();
    await reloadedWorkbook.xlsx.load(buffer);
    const reloadedWorksheet = reloadedWorkbook.getWorksheet(1) as ExcelJS.Worksheet;

    expect(parseWorksheet(reloadedWorksheet)).toHaveLength(1);

    const result = await importAssetsFromBuffer(buffer, 'medical', 7);

    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.inserted).toEqual([123]);
  });
});
