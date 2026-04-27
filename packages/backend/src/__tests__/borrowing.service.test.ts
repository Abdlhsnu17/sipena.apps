import { normalizeBorrowingDateFields } from '../services/borrowing.service';

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
