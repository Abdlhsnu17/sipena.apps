import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
let bootstrapPromise = null;

export async function ensureTestAdmin() {
  if (!bootstrapPromise) {
    bootstrapPromise = execFileAsync("npm", ["run", "bootstrap:test-admin", "--workspace=inventory-backend"], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  await bootstrapPromise;
}
