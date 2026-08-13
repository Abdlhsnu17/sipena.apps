import type { Application } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/database', async () => {
  const { databaseModuleMock } = await import('../test-support/database-mock');
  return databaseModuleMock();
});

import { createApp } from '../app';
import {
  AUTH_USER_LOOKUP,
  TEST_JWT_SECRET,
  bearer,
  createUserRow,
  signTokenFor,
} from '../test-support/auth-fixtures';
import { createBorrowingRow, stubBorrowingListQueries } from '../test-support/borrowing-fixtures';
import { executedQueries, onQuery, resetDatabaseMock } from '../test-support/database-mock';
import { requestApp } from '../test-support/http-invoke';

let app: Application;

/** Mengautentikasi permintaan sebagai pengguna dengan peran tertentu. */
const authAs = (role: string) => {
  const row = createUserRow({ role });
  onQuery(AUTH_USER_LOOKUP, [row]);
  return { row, token: signTokenFor(row) };
};

beforeAll(() => {
  app = createApp();
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

beforeEach(() => {
  resetDatabaseMock();
});

describe('autentikasi pada seluruh modul peminjaman', () => {
  it('menolak akses tanpa token', async () => {
    const response = await requestApp(app).get('/api/borrowing');

    expect(response.status).toBe(401);
  });

  it('menolak akses tanpa token pada endpoint aksi', async () => {
    const response = await requestApp(app).patch('/api/borrowing/1/approve').send({});

    expect(response.status).toBe(401);
  });

  it('menolak token kedaluwarsa', async () => {
    const row = createUserRow();
    const expiredToken = signTokenFor(row, { exp: Math.floor(Date.now() / 1000) - 60 });
    onQuery(AUTH_USER_LOOKUP, [row]);

    const response = await requestApp(app)
      .get('/api/borrowing')
      .set('Authorization', bearer(expiredToken));

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
  });
});

describe('GET /api/borrowing', () => {
  it('mengembalikan daftar beserta metadata paginasi', async () => {
    const { token } = authAs('admin');
    stubBorrowingListQueries([createBorrowingRow()], 1);

    const response = await requestApp(app).get('/api/borrowing').set('Authorization', bearer(token));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('menghitung totalPages dari total dan limit', async () => {
    const { token } = authAs('admin');
    stubBorrowingListQueries([createBorrowingRow()], 137);

    const response = await requestApp(app)
      .get('/api/borrowing?page=2&limit=10')
      .set('Authorization', bearer(token));

    expect(response.body.pagination).toMatchObject({ page: 2, limit: 10, total: 137, totalPages: 14 });
  });

  it('meneruskan filter status ke query database', async () => {
    const { token } = authAs('admin');
    stubBorrowingListQueries([]);

    await requestApp(app).get('/api/borrowing?status=overdue').set('Authorization', bearer(token));

    const dataQuery = executedQueries().find((entry) => /FROM borrowing_records b/.test(entry.sql));
    expect(dataQuery?.params).toContain('overdue');
  });

  it('menolak page nol', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app).get('/api/borrowing?page=0').set('Authorization', bearer(token));

    expect(response.status).toBe(400);
  });

  it('menolak limit di atas batas maksimum', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app)
      .get('/api/borrowing?limit=1001')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(400);
  });

  it('menolak status di luar daftar yang dikenal', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app)
      .get('/api/borrowing?status=entah')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(400);
  });

  it('menolak assetType di luar medical/non_medical', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app)
      .get('/api/borrowing?assetType=alat')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(400);
  });

  it('menolak search yang melebihi 200 karakter', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app)
      .get(`/api/borrowing?search=${'a'.repeat(201)}`)
      .set('Authorization', bearer(token));

    expect(response.status).toBe(400);
  });
});

describe('GET /api/borrowing/locks', () => {
  it('tidak diperlakukan sebagai parameter id', async () => {
    const { token } = authAs('admin');
    onQuery(/information_schema\.columns/, [{ count: 4 }]);
    onQuery(/UPDATE borrowing_records[\s\S]*SET status = 'overdue'/, { affectedRows: 0 });
    onQuery(/FROM borrowing_records/, []);

    const response = await requestApp(app)
      .get('/api/borrowing/locks')
      .set('Authorization', bearer(token));

    // Bila 'locks' tertangkap oleh route '/:id', validator param akan membalas 400.
    expect(response.status).not.toBe(400);
  });
});

describe('GET /api/borrowing/:id', () => {
  it('menolak id yang bukan bilangan bulat', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app)
      .get('/api/borrowing/abc')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(400);
  });

  it('menolak id nol', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app).get('/api/borrowing/0').set('Authorization', bearer(token));

    expect(response.status).toBe(400);
  });
});

describe('POST /api/borrowing', () => {
  const validPayload = {
    assetId: 11,
    borrowDate: '2026-08-01T02:00:00.000Z',
    purpose: 'Perawatan pasien ruang melati',
  };

  it('menolak payload tanpa assetId', async () => {
    const { token } = authAs('user');

    const response = await requestApp(app)
      .post('/api/borrowing')
      .set('Authorization', bearer(token))
      .send({ borrowDate: validPayload.borrowDate, purpose: validPayload.purpose });

    expect(response.status).toBe(400);
  });

  it('menolak keperluan yang kosong', async () => {
    const { token } = authAs('user');

    const response = await requestApp(app)
      .post('/api/borrowing')
      .set('Authorization', bearer(token))
      .send({ ...validPayload, purpose: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Keperluan peminjaman wajib diisi');
  });

  it('menolak borrowDate yang bukan ISO 8601', async () => {
    const { token } = authAs('user');

    const response = await requestApp(app)
      .post('/api/borrowing')
      .set('Authorization', bearer(token))
      .send({ ...validPayload, borrowDate: '01-08-2026' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Tanggal pinjam harus berupa tanggal dan waktu yang valid.');
  });

  it('menolak dueDate yang lebih awal dari borrowDate', async () => {
    const { token } = authAs('user');

    const response = await requestApp(app)
      .post('/api/borrowing')
      .set('Authorization', bearer(token))
      .send({ ...validPayload, dueDate: '2026-07-25T02:00:00.000Z' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Tanggal kembali harus lebih besar');
  });

  it('menerima dueDate yang sama persis dengan borrowDate', async () => {
    const { token } = authAs('user');
    // Payload lolos validasi, lalu gagal di lapisan data karena aset tidak di-stub.
    const response = await requestApp(app)
      .post('/api/borrowing')
      .set('Authorization', bearer(token))
      .send({ ...validPayload, dueDate: validPayload.borrowDate });

    expect(response.status).not.toBe(400);
  });

  it('menolak quantity nol', async () => {
    const { token } = authAs('user');

    const response = await requestApp(app)
      .post('/api/borrowing')
      .set('Authorization', bearer(token))
      .send({ ...validPayload, quantity: 0 });

    expect(response.status).toBe(400);
  });

  it('menolak purposeType di luar daftar', async () => {
    const { token } = authAs('user');

    const response = await requestApp(app)
      .post('/api/borrowing')
      .set('Authorization', bearer(token))
      .send({ ...validPayload, purposeType: 'di_luar_kota' });

    expect(response.status).toBe(400);
  });

  it('menolak loanDurationUnit di luar day/month/year', async () => {
    const { token } = authAs('user');

    const response = await requestApp(app)
      .post('/api/borrowing')
      .set('Authorization', bearer(token))
      .send({ ...validPayload, loanDurationUnit: 'week' });

    expect(response.status).toBe(400);
  });
});

describe('penegakan peran', () => {
  it('menolak staf biasa memperbarui peminjaman', async () => {
    const { token } = authAs('staff');

    const response = await requestApp(app)
      .patch('/api/borrowing/1')
      .set('Authorization', bearer(token))
      .send({ purpose: 'Diubah' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Insufficient permissions');
  });

  it('mengizinkan leader melewati pemeriksaan peran pada pembaruan', async () => {
    const { token } = authAs('leader');

    const response = await requestApp(app)
      .patch('/api/borrowing/1')
      .set('Authorization', bearer(token))
      .send({ purpose: 'Diubah' });

    expect(response.status).not.toBe(403);
  });

  it('menolak pengguna biasa menyetujui peminjaman', async () => {
    const { token } = authAs('user');

    const response = await requestApp(app)
      .patch('/api/borrowing/1/approve')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(403);
  });

  it('mengizinkan staff_pj menyetujui peminjaman', async () => {
    const { token } = authAs('staff_pj');

    const response = await requestApp(app)
      .patch('/api/borrowing/1/approve')
      .set('Authorization', bearer(token));

    expect(response.status).not.toBe(403);
  });

  it('menyamakan varian penulisan peran "staff pj" dengan staff_pj', async () => {
    const { token } = authAs('staff pj');

    const response = await requestApp(app)
      .patch('/api/borrowing/1/approve')
      .set('Authorization', bearer(token));

    expect(response.status).not.toBe(403);
  });

  it('menolak teknisi menghapus peminjaman', async () => {
    const { token } = authAs('teknisi');

    const response = await requestApp(app)
      .delete('/api/borrowing/1')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(403);
  });

  it('menolak leader menghapus peminjaman karena hanya admin yang boleh', async () => {
    const { token } = authAs('leader');

    const response = await requestApp(app)
      .delete('/api/borrowing/1')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(403);
  });

  it('menolak pengguna biasa memvalidasi pengembalian', async () => {
    const { token } = authAs('user');

    const response = await requestApp(app)
      .patch('/api/borrowing/1/validate-return')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(403);
  });

  it('memeriksa peran sebelum memvalidasi body pada penolakan', async () => {
    const { token } = authAs('user');

    const response = await requestApp(app)
      .patch('/api/borrowing/1/reject')
      .set('Authorization', bearer(token))
      .send({});

    // Peran diperiksa lebih dulu, jadi alasan yang hilang tidak pernah sampai ke validator.
    expect(response.status).toBe(403);
  });
});

describe('validasi aksi peminjaman', () => {
  it('mewajibkan alasan saat menolak peminjaman', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app)
      .patch('/api/borrowing/1/reject')
      .set('Authorization', bearer(token))
      .send({});

    expect(response.status).toBe(400);
  });

  it('mewajibkan kondisi saat mencatat pengembalian', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app)
      .patch('/api/borrowing/1/return')
      .set('Authorization', bearer(token))
      .send({});

    expect(response.status).toBe(400);
  });

  it('mewajibkan newDueDate berformat ISO 8601 saat perpanjangan', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app)
      .patch('/api/borrowing/1/extend')
      .set('Authorization', bearer(token))
      .send({ newDueDate: 'besok' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Tanggal jatuh tempo baru harus berupa tanggal dan waktu yang valid.');
  });

  it('menolak userId yang bukan bilangan bulat pada peminjaman pemblokir', async () => {
    const { token } = authAs('admin');

    const response = await requestApp(app)
      .get('/api/borrowing/user/abc/blocking')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(400);
  });
});
