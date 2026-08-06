import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import fs from "node:fs";
import mysql from "mysql2/promise";
import path from "node:path";

const requiredEnvVars = [
  "INITIAL_ADMIN_NIP",
  "INITIAL_ADMIN_NAME",
  "INITIAL_ADMIN_EMAIL",
  "INITIAL_ADMIN_PASSWORD",
  "INITIAL_ADMIN_PHONE",
];

const loadEnvironment = () => {
  // Tetap mengikuti urutan pencarian environment dari aplikasi backend.
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), ".docker.env"),
    path.resolve(process.cwd(), "../.docker.env"),
    path.resolve(process.cwd(), "../../.docker.env"),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    dotenv.config({ path: envPath, override: false });
    break;
  }
};

const readRequiredEnv = (name) => {
  const value = process.env[name]?.trim() || "";
  if (!value) {
    throw new Error(`Environment variable ${name} must be set`);
  }
  return value;
};

const createPool = () =>
  mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number.parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME || "sipena_db_local",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || undefined,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    queueLimit: 0,
    connectTimeout: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS || "10000", 10),
    idleTimeout: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS || "60000", 10),
    enableKeepAlive: true,
    keepAliveInitialDelay: Number.parseInt(process.env.DB_KEEP_ALIVE_INITIAL_DELAY_MS || "0", 10),
  });

const run = async () => {
  loadEnvironment();

  for (const name of requiredEnvVars) {
    readRequiredEnv(name);
  }

  const nip = readRequiredEnv("INITIAL_ADMIN_NIP");
  const name = readRequiredEnv("INITIAL_ADMIN_NAME");
  const email = readRequiredEnv("INITIAL_ADMIN_EMAIL");
  const password = readRequiredEnv("INITIAL_ADMIN_PASSWORD");
  const phoneNumber = readRequiredEnv("INITIAL_ADMIN_PHONE");
  const mustChangePassword =
    String(process.env.INITIAL_ADMIN_MUST_CHANGE_PASSWORD || "false").trim().toLowerCase() !== "false";

  const pool = createPool();

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const [existingRows] = await pool.query(
      "SELECT id, nip, name, email FROM users WHERE nip = ? OR email = ? LIMIT 1",
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

      console.log(`✅ Admin test diperbarui: ${existing.nip} (${existing.email}) -> ${nip} (${email})`);
      return;
    }

    const [result] = await pool.query(
      `INSERT INTO users (nip, name, email, password, role, phone_number, account_status, must_change_password)
       VALUES (?, ?, ?, ?, 'admin', ?, 'active', ?)`,
      [nip, name, email, hashedPassword, phoneNumber, mustChangePassword ? 1 : 0],
    );

    console.log(`✅ Admin test dibuat dengan id ${result.insertId}: ${nip} (${email})`);
  } finally {
    await pool.end();
  }
};

run().catch((error) => {
  console.error("❌ Gagal membuat admin test:", error);
  process.exit(1);
});
