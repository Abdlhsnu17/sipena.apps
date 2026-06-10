import pool from '../config/database';
import { BorrowingService, normalizeBorrowingDateFields } from '../services/borrowing.service';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('normalizeBorrowingDateFields', () => {
  it('converts borrowing datetime fields into stable local datetime strings', () => {
    const row = {
      id: 1,
      borrow_date: new Date(2026, 3, 28, 10, 15, 0),
      due_date: new Date(2026, 4, 5, 8, 0, 30),
      created_at: new Date(2026, 3, 27, 22, 45, 12),
      purpose: 'Uji sinkronisasi waktu',
    };

    expect(normalizeBorrowingDateFields(row)).toEqual({
      ...row,
      borrow_date: '2026-04-28 10:15:00',
      due_date: '2026-05-05 08:00:30',
      created_at: '2026-04-27 22:45:12',
    });
  });

  it('keeps non-datetime fields untouched', () => {
    const row = {
      id: 9,
      status: 'borrowed',
      borrow_date: '2026-04-28 14:20:00',
      notes: 'Tetap sama',
      return_validated_at: null,
    };

    expect(normalizeBorrowingDateFields(row)).toEqual(row);
  });
});

describe('BorrowingService borrowing lock rules', () => {
  const mockedQuery = pool.query as jest.Mock;
  let service: BorrowingService;

  beforeEach(() => {
    mockedQuery.mockReset();
    service = new BorrowingService();
  });

  it('rejects a new borrowing when the user still has an overdue borrowing', async () => {
    mockedQuery
      .mockResolvedValueOnce([[{ count: 4 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([
        [
          {
            id: 17,
            borrowing_code: 'PMJ-20260517-001',
            asset_name: 'Infusion Pump',
            due_date: new Date(2026, 4, 10, 9, 0, 0),
            status: 'overdue',
          },
        ],
        [],
      ]);

    const assetGetByIdSpy = jest.spyOn((service as any).assetService, 'getById');

    const result = await service.create({
      assetId: 12,
      assetType: 'medical',
      userId: 5,
      borrowDate: new Date(2026, 4, 17, 10, 0, 0),
      dueDate: new Date(2026, 4, 18, 10, 0, 0),
      purpose: 'Operasional unit',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Peminjaman baru ditolak');
    expect(result.message).toContain('melewati batas waktu');
    expect(result.message).toContain('Infusion Pump');
    expect(result.message).toContain('PMJ-20260517-001');
    expect(assetGetByIdSpy).not.toHaveBeenCalled();
  });

  it('rejects borrowing when the asset still has an active usage log', async () => {
    mockedQuery
      .mockResolvedValueOnce([[{ count: 4 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ count: 1 }], []]);

    jest.spyOn((service as any).assetService, 'getById').mockResolvedValue({
      success: true,
      data: {
        id: 12,
        status: 'available',
        specifications: { details: [] },
      },
    });

    const result = await service.create({
      assetId: 12,
      assetType: 'medical',
      userId: 5,
      borrowDate: new Date(2026, 4, 17, 10, 0, 0),
      dueDate: new Date(2026, 4, 18, 10, 0, 0),
      purpose: 'Operasional unit',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Alat sedang digunakan');
    expect(result.message).toContain('peminjaman');
    expect(mockedQuery).toHaveBeenCalledTimes(4);
  });

  it('rejects borrowing when the selected detail is marked as in use', async () => {
    mockedQuery
      .mockResolvedValueOnce([[{ count: 4 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ count: 0 }], []]);

    jest.spyOn((service as any).assetService, 'getById').mockResolvedValue({
      success: true,
      data: {
        id: 12,
        status: 'available',
        specifications: {
          details: [
            {
              id: 'detail-1',
              name: 'Infusion Pump Unit 1',
              status: 'Sedang Digunakan',
              condition: 'Baik',
            },
          ],
        },
      },
    });

    const result = await service.create({
      assetId: 12,
      assetType: 'medical',
      assetDetailId: 'detail-1',
      userId: 5,
      borrowDate: new Date(2026, 4, 17, 10, 0, 0),
      dueDate: new Date(2026, 4, 18, 10, 0, 0),
      purpose: 'Operasional unit',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Alat sedang digunakan');
    expect(result.message).toContain('peminjaman');
    expect(mockedQuery).toHaveBeenCalledTimes(4);
  });

  it('restores an overdue borrowing to borrowed after due date is extended to the future', async () => {
    mockedQuery
      .mockResolvedValueOnce([[{ count: 4 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([
        [
          {
            id: 18,
            status: 'overdue',
            borrow_date: '2026-05-10 09:00:00',
            due_date: '2026-05-12 09:00:00',
            asset_id: 4,
            asset_type: 'medical',
            user_id: 8,
            purpose: 'Operasional',
          },
        ],
        [],
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([
        [
          {
            id: 18,
            status: 'borrowed',
            borrow_date: '2026-05-10 09:00:00',
            due_date: '2026-05-20 09:00:00',
            asset_id: 4,
            asset_type: 'medical',
            user_id: 8,
            purpose: 'Operasional',
          },
        ],
        [],
      ]);

    const result = await service.update('18', {
      dueDate: new Date(2026, 4, 20, 9, 0, 0),
    });

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('borrowed');

    const updateCall = mockedQuery.mock.calls.find(
      ([query]) => String(query).includes('UPDATE borrowing_records SET') && String(query).includes('WHERE id = ?')
    );

    expect(updateCall).toBeDefined();

    const [updateQuery, updateParams] = updateCall as [string, any[]];
    expect(String(updateQuery)).toContain('status = ?');
    expect(updateParams[updateParams.length - 1]).toBe('18');
  });

  it('allows only the borrowing owner to extend an overdue borrowing', async () => {
    const getByIdSpy = jest.spyOn(service, 'getById')
      .mockResolvedValueOnce({
        success: true,
        message: 'Borrowing retrieved successfully',
        data: {
          id: 21,
          user_id: 8,
          status: 'overdue',
          extension_count: 1,
          is_extension_blocked: false,
        } as any,
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'Borrowing retrieved successfully',
        data: {
          id: 21,
          user_id: 8,
          status: 'borrowed',
          extension_count: 2,
          is_extension_blocked: false,
        } as any,
      });

    mockedQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await service.extend(
      '21',
      { newDueDate: new Date(2099, 0, 1, 9, 0, 0) },
      8
    );

    expect(result.success).toBe(true);
    expect(getByIdSpy).toHaveBeenCalledTimes(2);

    const [updateQuery, updateParams] = mockedQuery.mock.calls[0] as [string, any[]];
    expect(String(updateQuery)).toContain('extension_count = ?');
    expect(updateParams).toContain(2);
  });

  it('rejects extension attempts from admin, leader, or any non-owner user', async () => {
    jest.spyOn(service, 'getById').mockResolvedValueOnce({
      success: true,
      message: 'Borrowing retrieved successfully',
      data: {
        id: 22,
        user_id: 8,
        status: 'overdue',
        extension_count: 0,
        is_extension_blocked: false,
      } as any,
    });

    const result = await service.extend(
      '22',
      { newDueDate: new Date(2099, 0, 1, 9, 0, 0) },
      1
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('peminjam sendiri');
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('rejects extension when the borrowing is extension-blocked even for its owner', async () => {
    jest.spyOn(service, 'getById').mockResolvedValueOnce({
      success: true,
      message: 'Borrowing retrieved successfully',
      data: {
        id: 23,
        user_id: 8,
        status: 'overdue',
        extension_count: 1,
        is_extension_blocked: true,
      } as any,
    });

    const result = await service.extend(
      '23',
      { newDueDate: new Date(2099, 0, 1, 9, 0, 0) },
      8
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Perpanjangan telah dikunci');
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
