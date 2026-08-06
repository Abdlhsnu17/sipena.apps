import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import path from 'path';
import pool, { connectDatabase, disconnectDatabase } from '../src/config/database';

interface UserRow extends RowDataPacket {
  id: number;
  nip: string;
  name: string;
  email: string;
}

const requiredEnvVars = [
  'INITIAL_ADMIN_NIP',
  'INITIAL_ADMIN_NAME',
  'INITIAL_ADMIN_EMAIL',
  'INITIAL_ADMIN_PASSWORD',
  'INITIAL_ADMIN_PHONE',
] as const;

const loadEnvironment = (): void => {
  // Urutan sama seperti src/config/env.ts: `.env` (host) lebih dulu, baru
  // `.docker.env` yang memakai hostname jaringan container.
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(process.cwd(), '.docker.env'),
    path.resolve(process.cwd(), '../.docker.env'),
    path.resolve(process.cwd(), '../../.docker.env'),
    path.resolve(__dirname, '../../.docker.env'),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    dotenv.config({ path: envPath, override: false });
    break;
  }
};

const readRequiredEnv = (name: (typeof requiredEnvVars)[number]): string => {
  const value = process.env[name]?.trim() || '';
  if (!value) {
    throw new Error(`Environment variable ${name} must be set`);
  }
  return value;
};

const run = async (): Promise<void> => {
  loadEnvironment();

  const nip = readRequiredEnv('INITIAL_ADMIN_NIP');
  const name = readRequiredEnv('INITIAL_ADMIN_NAME');
  const email = readRequiredEnv('INITIAL_ADMIN_EMAIL');
  const password = readRequiredEnv('INITIAL_ADMIN_PASSWORD');
  const phoneNumber = readRequiredEnv('INITIAL_ADMIN_PHONE');
  const mustChangePassword = String(process.env.INITIAL_ADMIN_MUST_CHANGE_PASSWORD || 'true')
    .trim()
    .toLowerCase() !== 'false';

  await connectDatabase();

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const [existingRows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email FROM users WHERE nip = ? OR email = ? LIMIT 1',
      [nip, email],
    );

    if (existingRows.length > 0) {
      const existing = existingRows[0];
      await pool.query(
        `UPDATE users
         SET nip = ?, name = ?, email = ?, password = ?, role = 'admin', phone_number = ?, account_status = 'active', must_change_password = ?, updated_at = NOW()
         WHERE id = ?`,
        [nip, name, email, hashedPassword, phoneNumber, mustChangePassword ? 1 : 0, existing.id],
      );

      console.log(
        `✅ Admin test diperbarui: ${existing.nip} (${existing.email}) -> ${nip} (${email})`,
      );
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (nip, name, email, password, role, phone_number, account_status, must_change_password)
       VALUES (?, ?, ?, ?, 'admin', ?, 'active', ?)`,
      [nip, name, email, hashedPassword, phoneNumber, mustChangePassword ? 1 : 0],
    );

    console.log(`✅ Admin test dibuat dengan id ${result.insertId}: ${nip} (${email})`);
  } finally {
    await disconnectDatabase();
  }
};

run().catch((error) => {
  console.error('❌ Gagal membuat admin test:', error);
  process.exit(1);
});
