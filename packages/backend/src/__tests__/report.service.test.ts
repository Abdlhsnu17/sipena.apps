import ExcelJS from 'exceljs';
import pool from '../config/database';
import { ReportService } from '../services/report.service';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('ReportService.getAssetReport', () => {
  const mockedQuery = pool.query as jest.Mock;
  let service: ReportService;

  beforeEach(() => {
    mockedQuery.mockReset();
    service = new ReportService();
  });

  it('does not filter asset master data by report period', async () => {
    mockedQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          asset_code: 'MED-ROOM-001',
          name: 'Ruang Medis',
          category: 'Medis',
          type: 'medical',
          status: 'available',
          condition: 'good',
          location: 'Ruang Medis',
          specifications: JSON.stringify({
            details: [
              {
                id: 'MED-01',
                assetCode: 'MED-ITEM-001',
                inventoryName: 'Patient Monitor',
                status: 'Aktif',
                condition: 'Baik',
                roomId: '1',
              },
            ],
          }),
          total_borrowings: 0,
          total_maintenance: 0,
        },
      ],
      [],
    ]);

    const result = await service.getAssetReport({
      startDate: '2026-06-06',
      endDate: '2026-06-08',
      type: 'medical',
    });

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [query, params] = mockedQuery.mock.calls[0];

    expect(String(query)).not.toContain('a.created_at >=');
    expect(String(query)).not.toContain('a.created_at <=');
    expect(String(query)).toContain('AND a.type = ?');
    expect(params).toEqual(['medical']);
    expect(result.data).toEqual([
      expect.objectContaining({
        id: 'MED-01',
        asset_id: 1,
        asset_code: 'MED-ITEM-001',
        asset_name: 'Ruang Medis',
        name: 'Patient Monitor',
        type: 'medical',
        status: 'Aktif',
        location: 'Ruang Medis',
      }),
    ]);
  });

  it('exports non-medical specification details as inventory rows', async () => {
    mockedQuery.mockResolvedValueOnce([
      [
        {
          id: 2,
          asset_code: 'NMD-ROOM-001',
          name: 'Ruang Non Medis',
          category: 'Non Medis',
          type: 'non_medical',
          status: 'available',
          condition: 'good',
          location: 'Ruang Non Medis',
          specifications: JSON.stringify({
            details: [
              {
                id: 'NMD-01',
                assetCode: 'NMD-ITEM-001',
                inventoryName: 'Air Conditioner Split',
                brandModel: 'Daikin',
                serialNumber: 'SN-001',
                status: 'Aktif',
                condition: 'Baik',
              },
            ],
          }),
          brand: null,
          model: null,
          serial_number: null,
          usage_purpose: 'Fasilitas Umum',
          total_borrowings: 0,
          total_maintenance: 0,
        },
      ],
      [],
    ]);

    const result = await service.getAssetReport({ type: 'non_medical' });
    const [query] = mockedQuery.mock.calls[0];

    expect(String(query)).toContain('warranty_expiry, specifications');
    expect(String(query)).not.toContain('NULL as specifications');
    expect(result.data).toEqual([
      expect.objectContaining({
        id: 'NMD-01',
        asset_id: 2,
        asset_code: 'NMD-ITEM-001',
        name: 'Air Conditioner Split',
        type: 'non_medical',
        brand_model: 'Daikin',
        serial_number: 'SN-001',
      }),
    ]);
  });

  it('exports asset Excel into separate worksheets per room', async () => {
    mockedQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          asset_code: 'MED-PERI',
          name: 'Ruangan Perinatologi',
          category: 'Medis',
          type: 'medical',
          status: 'available',
          condition: 'good',
          location: 'Ruangan Perinatologi',
          specifications: JSON.stringify({
            details: [
              {
                id: 'PERI-01',
                assetCode: 'MED-PERI-BED',
                inventoryName: 'Hospital Bed',
                status: 'Aktif',
                condition: 'Baik',
              },
            ],
          }),
          total_borrowings: 0,
          total_maintenance: 0,
        },
        {
          id: 2,
          asset_code: 'NON-PERI',
          name: 'Ruangan Perinatologi',
          category: 'Non Medis',
          type: 'non_medical',
          status: 'available',
          condition: 'good',
          location: 'Ruangan Perinatologi',
          specifications: JSON.stringify({
            details: [
              {
                id: 'PERI-NON-01',
                assetCode: 'NON-PERI-AC',
                inventoryName: 'Air Conditioner',
                status: 'Aktif',
                condition: 'Baik',
              },
            ],
          }),
          total_borrowings: 0,
          total_maintenance: 0,
        },
        {
          id: 3,
          asset_code: 'MED-WJK',
          name: 'Ruangan Wijayakusuma',
          category: 'Medis',
          type: 'medical',
          status: 'available',
          condition: 'good',
          location: 'Ruangan Wijayakusuma',
          specifications: JSON.stringify({
            details: [
              {
                id: 'WJK-01',
                assetCode: 'MED-WJK-MON',
                inventoryName: 'Patient Monitor',
                status: 'Aktif',
                condition: 'Baik',
              },
            ],
          }),
          total_borrowings: 0,
          total_maintenance: 0,
        },
      ],
      [],
    ]);

    const buffer = await service.exportToExcel({ reportType: 'assets' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual([
      'Ruangan Perinatologi',
      'Ruangan Wijayakusuma',
    ]);

    const perinatologi = workbook.getWorksheet('Ruangan Perinatologi');
    const wijayakusuma = workbook.getWorksheet('Ruangan Wijayakusuma');
    const perinatologiValues = (perinatologi?.getSheetValues() ?? []).flatMap((row) =>
      Array.isArray(row) ? row.map((value) => String(value ?? '')) : []
    );
    const wijayakusumaValues = (wijayakusuma?.getSheetValues() ?? []).flatMap((row) =>
      Array.isArray(row) ? row.map((value) => String(value ?? '')) : []
    );

    expect(perinatologi?.rowCount).toBe(3);
    expect(wijayakusuma?.rowCount).toBe(2);
    expect(perinatologiValues).toEqual(expect.arrayContaining(['Medis', 'Non Medis']));
    expect(wijayakusumaValues).toEqual(expect.arrayContaining(['Patient Monitor']));
  });

  it('exports all Excel with asset worksheets split per room', async () => {
    jest.spyOn(service, 'getDashboardStats').mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        totalAssets: 3,
        totalMedicalAssets: 2,
        totalNonMedicalAssets: 1,
        availableAssets: 3,
        borrowedAssets: 0,
        maintenanceAssets: 0,
        totalBorrowings: 0,
        pendingBorrowings: 0,
        activeBorrowings: 0,
        overdueBorrowings: 0,
        activeSanctions: 0,
        totalMaintenance: 0,
        scheduledMaintenance: 0,
        totalUsers: 1,
        assetStatusSummary: [],
        borrowingStatusSummary: [],
        maintenanceStatusSummary: [],
        dueNotifications: [],
      },
    });
    jest.spyOn(service, 'getAssetReport').mockResolvedValue({
      success: true,
      message: 'ok',
      data: [
        {
          id: 'PERI-01',
          asset_code: 'MED-PERI-BED',
          asset_name: 'Ruangan Perinatologi',
          name: 'Hospital Bed',
          category: 'Medis',
          type: 'medical',
          status: 'Aktif',
          location: 'Ruangan Perinatologi',
        },
        {
          id: 'PERI-NON-01',
          asset_code: 'NON-PERI-AC',
          asset_name: 'Ruangan Perinatologi',
          name: 'Air Conditioner',
          category: 'Non Medis',
          type: 'non_medical',
          status: 'Aktif',
          location: 'Ruangan Perinatologi',
        },
        {
          id: 'WJK-01',
          asset_code: 'MED-WJK-MON',
          asset_name: 'Ruangan Wijayakusuma',
          name: 'Patient Monitor',
          category: 'Medis',
          type: 'medical',
          status: 'Aktif',
          location: 'Ruangan Wijayakusuma',
        },
      ],
    });
    jest.spyOn(service, 'getBorrowingReport').mockResolvedValue({ success: true, message: 'ok', data: [] });
    jest.spyOn(service, 'getMaintenanceReport').mockResolvedValue({ success: true, message: 'ok', data: [] });
    jest.spyOn(service, 'getUsageReport').mockResolvedValue({ success: true, message: 'ok', data: [] });
    jest.spyOn(service, 'getActivityReport').mockResolvedValue({ success: true, message: 'ok', data: [] });
    jest.spyOn(service, 'getUploadReport').mockResolvedValue({ success: true, message: 'ok', data: [] });

    const buffer = await service.exportToExcel({ reportType: 'all', actorUserId: 1, actorRole: 'admin' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual([
      'Ringkasan',
      'Ruangan Perinatologi',
      'Ruangan Wijayakusuma',
      'Peminjaman',
      'Pemeliharaan',
      'Penggunaan',
      'Aktivitas',
      'Unggahan',
    ]);
    expect(workbook.getWorksheet('Aset')).toBeUndefined();
    expect(workbook.getWorksheet('Ruangan Perinatologi')?.rowCount).toBe(3);
    expect(workbook.getWorksheet('Ruangan Wijayakusuma')?.rowCount).toBe(2);
  });

  it('exports usage Excel with separate tool code, tool name, and description columns', async () => {
    mockedQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          no: 'PG-20260607-001',
          asset_id: 10,
          asset_master_id: 10,
          asset_type: 'medical',
          asset_detail_id: 'WJKS-01',
          item_id: 'WJKS-01',
          asset_detail_name: 'Patient Monitor',
          asset_detail_code: 'MED-WJKS-001',
          asset_name: 'Patient Monitor',
          asset_code: 'MED-WJKS-001',
          tool_name: 'Patient Monitor',
          tool_code: 'MED-WJKS-001',
          room_name: 'Ruangan Wijayakusuma',
          asset_location: 'Ruangan Wijayakusuma',
          operator_name: 'Hafsah Nuzulfah',
          operator_nip: '2001031720252110',
          usage_context: 'own_room',
          started_at: '2026-06-07 09:00:00',
          ended_at: '2026-06-07 10:00:00',
          usage_count: 1,
          condition_before: 'good',
          condition_after: 'good',
          notes: 'Dipakai untuk monitoring pasien',
          description: 'Dipakai untuk monitoring pasien',
          created_by_name: 'Hafsah Nuzulfah',
          created_at: '2026-06-07 09:00:00',
          updated_at: '2026-06-07 10:00:00',
        },
      ],
      [],
    ]);

    const buffer = await service.exportToExcel({ reportType: 'usage' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.getWorksheet('Laporan Penggunaan');
    const headers = (worksheet?.getRow(1).values as unknown[]).map((value) => String(value ?? ''));
    const values = (worksheet?.getRow(2).values as unknown[]).map((value) => String(value ?? ''));

    expect(headers).toEqual(expect.arrayContaining(['ID Barang', 'ID Aset Master', 'Kode Alat', 'Nama Alat', 'Keterangan']));
    expect(headers).not.toEqual(expect.arrayContaining(['Catatan']));
    expect(values).toEqual(expect.arrayContaining(['WJKS-01', '10', 'MED-WJKS-001', 'Patient Monitor', 'Dipakai untuk monitoring pasien']));
  });

  it('exports activity Excel with usage tool details split from description', async () => {
    mockedQuery.mockResolvedValueOnce([
      [
        {
          id: 21,
          user_id: 3,
          user_name: 'Hafsah Nuzulfah',
          user_nip: '2001031720252110',
          feature: 'penggunaan_alat',
          action: 'create',
          description: 'Mencatat penggunaan alat MED-WJKS-001',
          metadata_json: JSON.stringify({
            assetCode: 'MED-WJKS-001',
            assetName: 'Patient Monitor',
          }),
          created_at: '2026-06-07 09:00:00',
        },
      ],
      [],
    ]);

    const buffer = await service.exportToExcel({ reportType: 'activity', actorUserId: 1, actorRole: 'admin' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.getWorksheet('Laporan Riwayat Aktivitas');
    const headers = (worksheet?.getRow(1).values as unknown[]).map((value) => String(value ?? ''));
    const values = (worksheet?.getRow(2).values as unknown[]).map((value) => String(value ?? ''));

    expect(headers).toEqual(expect.arrayContaining(['Kode Alat', 'Nama Alat', 'Keterangan']));
    expect(headers).not.toEqual(expect.arrayContaining(['Metadata']));
    expect(values).toEqual(expect.arrayContaining(['MED-WJKS-001', 'Patient Monitor', 'Mencatat penggunaan alat']));
    expect(values).not.toEqual(expect.arrayContaining(['Mencatat penggunaan alat MED-WJKS-001']));
  });
});
