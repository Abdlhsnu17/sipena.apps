import bcrypt from 'bcryptjs';
import type { Application } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Pool database diganti tiruan agar seluruh lapisan HTTP — rate limiter, parser,
// rantai validator, middleware auth, controller, dan service — tetap dieksekusi
// apa adanya tanpa perlu MySQL yang berjalan.
vi.mock('../config/database', async () => {
  const { databaseModuleMock } = await import('../test-support/database-mock');
  return databaseModuleMock();
});

import { createApp } from '../app';
import {
  AUTH_USER_LOOKUP,
  LOGIN_USER_LOOKUP,
  TEST_JWT_SECRET,
  bearer,
  createUserRow,
  signTokenFor,
} from '../test-support/auth-fixtures';
import { stubBorrowingListQueries } from '../test-support/borrowing-fixtures';
import { onQuery, resetDatabaseMock } from '../test-support/database-mock';
import { requestApp } from '../test-support/http-invoke';

const PASSWORD = 'Password123';
// Rounds rendah: test hanya perlu hash yang benar-benar cocok, bukan yang kuat.
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

let app: Application;

beforeAll(() => {
  // createApp memuat file .env milik pengembang, jadi secret disetel sesudahnya
  // agar token yang ditandatangani test selalu cocok dengan yang diverifikasi.
  app = createApp();
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

beforeEach(() => {
  resetDatabaseMock();
});

describe('POST /api/auth/login', () => {
  it('menolak body kosong dengan pesan validator', async () => {
    const response = await requestApp(app).post('/api/auth/login').send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Username atau email wajib diisi');
  });

  it('menolak nip berisi spasi saja', async () => {
    const response = await requestApp(app).post('/api/auth/login').send({ nip: '   ', password: 'x' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Username atau email wajib diisi');
  });

  it('menolak password kosong', async () => {
    const response = await requestApp(app).post('/api/auth/login').send({ nip: '199203102019031005' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Password wajib diisi');
  });

  it('membalas 404 ketika akun tidak ditemukan', async () => {
    onQuery(LOGIN_USER_LOOKUP, []);

    const response = await requestApp(app)
      .post('/api/auth/login')
      .send({ nip: 'tidak-ada', password: PASSWORD });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, message: 'Akun tidak ditemukan' });
  });

  it('membalas 401 ketika password salah dan mencatat percobaan gagal', async () => {
    onQuery(LOGIN_USER_LOOKUP, [createUserRow({ password: PASSWORD_HASH })]);
    onQuery(/UPDATE users SET failed_login_attempts/, { affectedRows: 1 });

    const response = await requestApp(app)
      .post('/api/auth/login')
      .send({ nip: '199203102019031005', password: 'PasswordSalah1' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Password yang Anda masukkan salah');
  });

  it('mengunci akun setelah percobaan gagal kelima', async () => {
    onQuery(LOGIN_USER_LOOKUP, [createUserRow({ password: PASSWORD_HASH, failed_login_attempts: 4 })]);
    onQuery(/UPDATE users SET failed_login_attempts/, { affectedRows: 1 });

    const response = await requestApp(app)
      .post('/api/auth/login')
      .send({ nip: '199203102019031005', password: 'PasswordSalah1' });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('Akun terkunci sementara');
  });

  it('menolak login akun yang ditangguhkan tanpa memeriksa password', async () => {
    onQuery(LOGIN_USER_LOOKUP, [
      createUserRow({ password: PASSWORD_HASH, account_status: 'suspended' }),
    ]);

    const response = await requestApp(app)
      .post('/api/auth/login')
      .send({ nip: '199203102019031005', password: PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('ditangguhkan');
  });

  it('menolak login selama akun masih terkunci', async () => {
    onQuery(LOGIN_USER_LOOKUP, [
      createUserRow({
        password: PASSWORD_HASH,
        locked_until: new Date(Date.now() + 5 * 60 * 1000),
      }),
    ]);

    const response = await requestApp(app)
      .post('/api/auth/login')
      .send({ nip: '199203102019031005', password: PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('Akun terkunci sementara');
  });

  it('mengembalikan token dan profil tanpa membocorkan hash password', async () => {
    onQuery(LOGIN_USER_LOOKUP, [createUserRow({ password: PASSWORD_HASH })]);
    onQuery(/UPDATE users SET last_login = NOW\(\)/, { affectedRows: 1 });

    const response = await requestApp(app)
      .post('/api/auth/login')
      .send({ nip: '199203102019031005', password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.token).toBe('string');
    expect(response.body.data.user).toMatchObject({ id: 7, role: 'admin' });
    expect(response.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD_HASH);
  });

  it('menerima email sebagai identitas login', async () => {
    onQuery(LOGIN_USER_LOOKUP, [createUserRow({ password: PASSWORD_HASH })]);
    onQuery(/UPDATE users SET last_login = NOW\(\)/, { affectedRows: 1 });

    const response = await requestApp(app)
      .post('/api/auth/login')
      .send({ nip: 'siti@rs.example.id', password: PASSWORD });

    expect(response.status).toBe(200);
  });
});

describe('POST /api/auth/register', () => {
  const validPayload = {
    nip: '199203102019031005',
    name: 'Pengguna Baru',
    email: 'baru@rs.example.id',
    phoneNumber: '081234567890',
    password: PASSWORD,
    confirmPassword: PASSWORD,
  };

  it('menolak password yang tidak memenuhi kebijakan', async () => {
    const response = await requestApp(app)
      .post('/api/auth/register')
      .send({ ...validPayload, password: 'lemah', confirmPassword: 'lemah' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Password minimal 8 karakter');
  });

  it('menolak konfirmasi password yang tidak cocok', async () => {
    const response = await requestApp(app)
      .post('/api/auth/register')
      .send({ ...validPayload, confirmPassword: 'Password124' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('menolak email yang tidak valid', async () => {
    const response = await requestApp(app)
      .post('/api/auth/register')
      .send({ ...validPayload, email: 'bukan-email' });

    expect(response.status).toBe(400);
  });

  it('menolak nomor telepon kosong', async () => {
    const response = await requestApp(app)
      .post('/api/auth/register')
      .send({ ...validPayload, phoneNumber: '' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Nomor WhatsApp/SMS wajib diisi');
  });

  it('membalas 409 ketika NIP atau email sudah terdaftar', async () => {
    onQuery(/SELECT id FROM users WHERE nip = \?/, [{ id: 1 }]);

    const response = await requestApp(app).post('/api/auth/register').send(validPayload);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('menolak kode verifikasi yang bukan 6 digit', async () => {
    const response = await requestApp(app).post('/api/auth/reset-password').send({
      nip: '199203102019031005',
      verificationCode: '123',
      newPassword: PASSWORD,
      confirmPassword: PASSWORD,
    });

    expect(response.status).toBe(400);
  });

  it('menolak kode verifikasi non-numerik', async () => {
    const response = await requestApp(app).post('/api/auth/reset-password').send({
      nip: '199203102019031005',
      verificationCode: 'abcdef',
      newPassword: PASSWORD,
      confirmPassword: PASSWORD,
    });

    expect(response.status).toBe(400);
  });

  it('menolak password baru yang lemah', async () => {
    const response = await requestApp(app).post('/api/auth/reset-password').send({
      nip: '199203102019031005',
      verificationCode: '123456',
      newPassword: 'lemah',
      confirmPassword: 'lemah',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Password minimal 8 karakter');
  });

  it('menolak permintaan verifikasi tanpa nip', async () => {
    const response = await requestApp(app).post('/api/auth/reset-password/verify').send({});

    expect(response.status).toBe(400);
  });

  it('menerima payload reset token tanpa nip dan kode verifikasi', async () => {
    // Token acak yang tidak tersimpan: validator lolos, lalu service menolaknya
    // karena sesi resetnya tidak ada.
    const response = await requestApp(app).post('/api/auth/reset-password').send({
      resetToken: 'a'.repeat(64),
      newPassword: PASSWORD,
      confirmPassword: PASSWORD,
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Sesi reset password tidak valid');
  });

  it('menolak reset token yang terlalu pendek', async () => {
    const response = await requestApp(app).post('/api/auth/reset-password').send({
      resetToken: 'pendek',
      newPassword: PASSWORD,
      confirmPassword: PASSWORD,
    });

    expect(response.status).toBe(400);
  });
});

describe('POST /api/auth/reset-password/verify-otp', () => {
  it('menolak kode verifikasi yang bukan 6 digit', async () => {
    const response = await requestApp(app).post('/api/auth/reset-password/verify-otp').send({
      nip: '199203102019031005',
      verificationCode: '123',
    });

    expect(response.status).toBe(400);
  });

  it('menolak kode untuk nip yang tidak dikenal', async () => {
    onQuery(/FROM users WHERE nip = \?/i, []);

    const response = await requestApp(app).post('/api/auth/reset-password/verify-otp').send({
      nip: '199203102019031005',
      verificationCode: '123456',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data?.resetToken).toBeUndefined();
  });
});

describe('POST /api/auth/reset-password/resend', () => {
  it('menolak permintaan kirim ulang tanpa nip', async () => {
    const response = await requestApp(app).post('/api/auth/reset-password/resend').send({});

    expect(response.status).toBe(400);
  });

  it('membalas pesan generik untuk nip yang tidak terdaftar', async () => {
    onQuery(/FROM users WHERE nip = \?/i, []);

    const response = await requestApp(app).post('/api/auth/reset-password/resend').send({
      nip: '199203102019031005',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    // NIP asing tetap menerima tujuan tersamar berbentuk nomor telepon agar
    // tidak bisa dibedakan dari akun sungguhan, tanpa membocorkan kanal.
    expect(response.body.data.deliveryTarget).toMatch(/^\+628\*{7}\d{3}$/);
    expect(response.body.data.expiresInMinutes).toBe(10);
    expect(response.body.data.deliveryMethod).toBeUndefined();
    expect(response.body.data.previewCode).toBeUndefined();
  });

  it('memakai tujuan umpan yang sama untuk nip yang sama', async () => {
    onQuery(/FROM users WHERE nip = \?/i, []);

    const first = await requestApp(app).post('/api/auth/reset-password/verify').send({
      nip: '199203102019031008',
    });
    const second = await requestApp(app).post('/api/auth/reset-password/verify').send({
      nip: '199203102019031008',
    });

    expect(first.body.data.deliveryTarget).toMatch(/^\+628\*{7}\d{3}$/);
    expect(second.body.data.deliveryTarget).toBe(first.body.data.deliveryTarget);
  });

  it('memperlakukan akun ditangguhkan sama seperti nip yang tidak dikenal', async () => {
    onQuery(/FROM users WHERE nip = \?/i, [
      createUserRow({ nip: '199203102019031006', account_status: 'suspended' }),
    ]);

    const response = await requestApp(app).post('/api/auth/reset-password/verify').send({
      nip: '199203102019031006',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.deliveryTarget).toMatch(/^\+628\*{7}\d{3}$/);
    expect(response.body.data.expiresInMinutes).toBe(10);
    expect(response.body.data.resendAvailableInSeconds).toBe(60);
  });

  it('memperlakukan akun tanpa nomor telepon sama seperti nip yang tidak dikenal', async () => {
    onQuery(/FROM users WHERE nip = \?/i, [
      createUserRow({ nip: '199203102019031009', phone_number: null }),
    ]);

    const response = await requestApp(app).post('/api/auth/reset-password/verify').send({
      nip: '199203102019031009',
    });

    expect(response.status).toBe(200);
    // Tujuan umpan, bukan email: kanal email sudah dicabut dari alur OTP.
    expect(response.body.data.deliveryTarget).toMatch(/^\+628\*{7}\d{3}$/);
    expect(response.body.data.previewCode).toBeUndefined();
  });

  it('menahan permintaan kedua selama cooldown masih berjalan', async () => {
    onQuery(/FROM users WHERE nip = \?/i, []);

    const first = await requestApp(app).post('/api/auth/reset-password/verify').send({
      nip: '199203102019031007',
    });
    const second = await requestApp(app).post('/api/auth/reset-password/verify').send({
      nip: '199203102019031007',
    });

    expect(first.body.data.resendAvailableInSeconds).toBe(60);
    expect(second.status).toBe(200);
    expect(second.body.success).toBe(true);
    expect(second.body.message).toContain('Kode baru dapat diminta dalam');
    expect(second.body.data.resendAvailableInSeconds).toBeLessThanOrEqual(60);
  });
});

describe('GET /api/auth/me', () => {
  it('menolak permintaan tanpa header Authorization', async () => {
    const response = await requestApp(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('No token provided or invalid format');
  });

  it('menolak skema selain Bearer', async () => {
    const response = await requestApp(app)
      .get('/api/auth/me')
      .set('Authorization', 'Basic c2l0aTpyYWhhc2lh');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('No token provided or invalid format');
  });

  it('menolak token yang tidak dapat diverifikasi', async () => {
    const response = await requestApp(app).get('/api/auth/me').set('Authorization', bearer('bukan.token.valid'));

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
  });

  it('menolak token yang ditandatangani secret lain', async () => {
    const row = createUserRow();
    const foreignToken = signTokenFor(row);
    process.env.JWT_SECRET = 'secret-lain-yang-cukup-panjang-untuk-uji-1234';
    onQuery(AUTH_USER_LOOKUP, [row]);

    const response = await requestApp(app).get('/api/auth/me').set('Authorization', bearer(foreignToken));
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    expect(response.status).toBe(401);
  });

  it('menolak token yang sesinya sudah di-invalidate', async () => {
    const row = createUserRow({ session_version: 4 });
    // Token diterbitkan pada versi sesi lama; logout menaikkan versi di database.
    const token = signTokenFor({ ...row, session_version: 3 });
    onQuery(AUTH_USER_LOOKUP, [row]);

    const response = await requestApp(app).get('/api/auth/me').set('Authorization', bearer(token));

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Session has been invalidated');
  });

  it('menolak akun yang ditangguhkan dengan 403', async () => {
    const row = createUserRow({ account_status: 'suspended' });
    onQuery(AUTH_USER_LOOKUP, [row]);

    const response = await requestApp(app).get('/api/auth/me').set('Authorization', bearer(signTokenFor(row)));

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('ditangguhkan');
  });

  it('menolak akun nonaktif dengan 403', async () => {
    const row = createUserRow({ account_status: 'inactive' });
    onQuery(AUTH_USER_LOOKUP, [row]);

    const response = await requestApp(app).get('/api/auth/me').set('Authorization', bearer(signTokenFor(row)));

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('nonaktif');
  });

  it('menolak token milik pengguna yang sudah dihapus', async () => {
    const row = createUserRow();
    onQuery(AUTH_USER_LOOKUP, []);

    const response = await requestApp(app).get('/api/auth/me').set('Authorization', bearer(signTokenFor(row)));

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
  });

  it('tetap dapat diakses ketika pengguna wajib mengganti password', async () => {
    const row = createUserRow({ must_change_password: 1 });
    onQuery(AUTH_USER_LOOKUP, [row]);
    onQuery(/FROM users/, [row]);

    const response = await requestApp(app).get('/api/auth/me').set('Authorization', bearer(signTokenFor(row)));

    expect(response.status).toBe(200);
  });
});

describe('kewajiban ganti password', () => {
  it('memblokir modul lain dengan 403 selama password belum diganti', async () => {
    const row = createUserRow({ must_change_password: 1 });
    onQuery(AUTH_USER_LOOKUP, [row]);

    const response = await requestApp(app)
      .get('/api/borrowing')
      .set('Authorization', bearer(signTokenFor(row)));

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('wajib mengganti password');
  });

  it('tidak memblokir modul apa pun ketika password sudah sesuai', async () => {
    const row = createUserRow();
    onQuery(AUTH_USER_LOOKUP, [row]);
    stubBorrowingListQueries([]);

    const response = await requestApp(app)
      .get('/api/borrowing')
      .set('Authorization', bearer(signTokenFor(row)));

    expect(response.status).toBe(200);
  });
});
