import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";

/**
 * Menyiapkan akun admin khusus pengujian pada stack Docker Compose.
 *
 * Untuk stack yang dijalankan langsung di host (MySQL lokal + `npm run dev`)
 * gunakan `npm run bootstrap:test-admin`, yang menjalankan skrip backend
 * terhadap database pada `.env` host.
 */

const execFileAsync = promisify(execFile);
const repoRoot = existsSync(path.resolve(process.cwd(), "docker/compose.yml"))
  ? process.cwd()
  : path.resolve(process.cwd(), "../..");
const composeArgs = [
  "compose",
  "-f",
  "docker/compose.yml",
  "-f",
  "docker/compose.override.yml",
  "--env-file",
  ".docker.env",
];

function describe(error) {
  // `execFile` menaruh penyebab sebenarnya pada stderr, sedangkan `message`
  // hanya berisi perintah yang gagal.
  return [error?.message, error?.stderr, error?.stdout]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("\n");
}

async function runDockerCompose(args) {
  const { stdout } = await execFileAsync("docker", [...composeArgs, ...args], {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

async function run() {
  await runDockerCompose(["up", "--build", "-d", "backend"]);
  const output = await runDockerCompose([
    "exec",
    "-T",
    "backend",
    "node",
    "scripts/bootstrap-test-admin.mjs",
  ]);
  if (output.trim()) console.log(output.trim());
}

run().catch((error) => {
  console.error("❌ Gagal menyiapkan admin test lewat Docker Compose:", describe(error));
  process.exit(1);
});
