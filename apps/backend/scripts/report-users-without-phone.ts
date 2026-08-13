import pool, { connectDatabase, disconnectDatabase } from '../src/config/database';
import { isValidPhoneNumber } from '../src/utils/otp-delivery';
import type { RowDataPacket } from 'mysql2';

/**
 * Mendata akun yang belum punya nomor telepon valid.
 *
 * Sejak OTP reset password hanya dikirim ke nomor terdaftar, akun-akun ini
 * tidak bisa memulihkan passwordnya sendiri. Mereka akan diarahkan melengkapi
 * profil saat login berikutnya; daftar ini dipakai admin untuk menghubungi
 * pemilik akun yang tidak kunjung login.
 */
interface UserContactRow extends RowDataPacket {
  id: number;
  nip: string;
  name: string;
  email: string;
  role: string;
  phone_number: string | null;
  account_status: string | null;
  last_login: Date | null;
}

const run = async (): Promise<void> => {
  await connectDatabase();

  try {
    const [rows] = await pool.query<UserContactRow[]>(
      `SELECT id, nip, name, email, role, phone_number, account_status, last_login
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY account_status, name`,
    );

    const incomplete = rows.filter((row) => !row.phone_number || !isValidPhoneNumber(row.phone_number));

    if (incomplete.length === 0) {
      console.log(`✅ Semua ${rows.length} akun aktif sudah punya nomor telepon valid.`);
      return;
    }

    console.log(`⚠️  ${incomplete.length} dari ${rows.length} akun belum punya nomor telepon valid:\n`);
    console.table(
      incomplete.map((row) => ({
        id: row.id,
        nip: row.nip,
        nama: row.name,
        email: row.email,
        role: row.role,
        status: row.account_status || 'active',
        nomor: row.phone_number || '(kosong)',
        login_terakhir: row.last_login ? new Date(row.last_login).toISOString().slice(0, 10) : '(belum pernah)',
      })),
    );
    console.log(
      '\nAkun di atas tidak dapat memakai fitur lupa password sampai nomornya diisi.\n' +
        'Mereka akan diminta melengkapi nomor saat login berikutnya. Untuk akun yang sudah\n' +
        'terlanjur lupa password, admin/leader dapat memakai PATCH /api/users/:id/password/reset.',
    );
  } finally {
    await disconnectDatabase();
  }
};

run().catch((error) => {
  console.error('❌ Gagal menyusun laporan akun tanpa nomor telepon:', error);
  process.exit(1);
});
