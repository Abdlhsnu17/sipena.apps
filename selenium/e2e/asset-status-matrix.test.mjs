import { after, before, test } from "node:test";
import { By, until } from "selenium-webdriver";
import {
  createDriver,
  openPath,
  saveScreenshot,
  timeout,
  waitForApplication,
  waitForPath,
  warmUpRoutes,
} from "../support/browser.mjs";
import { ensureTestAdmin } from "../support/bootstrap-admin.mjs";
import { createAssetStatusMatrix } from "../support/asset-status-matrix.mjs";
import { adminPassword, adminUsername } from "../support/config.mjs";

/**
 * Smoke test matriks status aset.
 *
 * Setiap sel pada matriks berikut dijalankan sebagai satu test tersendiri
 * sehingga kegagalan langsung menunjuk baris dan kolom yang melanggar aturan:
 *
 *   Status aset        | Peminjaman baru | Penggunaan antarunit | Pemeliharaan
 *   -------------------+-----------------+----------------------+-------------
 *   Tersedia           | Diizinkan       | Diizinkan            | Diizinkan
 *   Sedang digunakan   | Ditolak         | Ditolak              | Ditolak
 *   Dipinjam           | Ditolak         | Ditolak              | Ditolak
 *   Rusak              | Ditolak         | Ditolak              | Diizinkan
 *   Dalam pemeliharaan | Ditolak         | Ditolak              | —
 *
 * Baris "Rusak" diverifikasi lewat daftar pilihan pada formulir, bukan respons
 * API; alasannya dijelaskan pada `selenium/support/asset-status-matrix.mjs`.
 */

const runId = `${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
const warmUpPaths = ["/login", "/", "/borrowing", "/asset-usage", "/maintenance"];

let driver;

const matrix = createAssetStatusMatrix({
  getDriver: () => driver,
  runId,
});

before(async () => {
  await ensureTestAdmin();
  await waitForApplication();
  await warmUpRoutes(warmUpPaths);
  driver = await createDriver();
});

after(async () => {
  try {
    await matrix.cleanup();
  } finally {
    if (driver) await driver.quit();
  }
});

test("Login dengan akun admin", async () => {
  try {
    await openPath(driver, "/login");
    const nipInput = await driver.wait(until.elementLocated(By.id("nip")), timeout);
    await driver.wait(until.elementIsVisible(nipInput), timeout);
    await nipInput.sendKeys(adminUsername);
    await driver.findElement(By.id("password")).sendKeys(adminPassword);
    await driver.findElement(By.xpath('//button[normalize-space()="Masuk"]')).click();
    await waitForPath(driver, "/");
    await saveScreenshot(driver, "matrix-login", "pass");
  } catch (error) {
    await saveScreenshot(driver, "matrix-login", "fail");
    throw error;
  }
});

test("Siapkan aset uji pada setiap status", async () => {
  console.log(await matrix.setup());
});

for (const matrixCase of matrix.cases) {
  const name = `${matrixCase.row} → ${matrixCase.column}: ${matrixCase.expectation}`;
  const options = matrixCase.skip ? { skip: matrixCase.skip } : {};

  test(name, options, async () => {
    try {
      const detail = await matrixCase.run();
      console.log(`${name}\n${detail}`);
      await openPath(driver, matrixCase.evidencePath);
      await saveScreenshot(driver, `matrix-${matrixCase.key}`, "pass");
    } catch (error) {
      await saveScreenshot(driver, `matrix-${matrixCase.key}`, "fail");
      throw error;
    }
  });
}

test("Ringkasan matriks status aset", async () => {
  console.log(`\n${matrix.renderSummary()}\n`);
});

test("Bersihkan data uji matriks status aset", async () => {
  await matrix.cleanup();
});
