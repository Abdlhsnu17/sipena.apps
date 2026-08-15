import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Builder, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

const execFileAsync = promisify(execFile);
export const baseUrl = (process.env.SELENIUM_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const defaultTimeout = process.env.SELENIUM_HEADLESS === "false" ? 60_000 : 20_000;
export const timeout = Number(process.env.SELENIUM_TIMEOUT_MS || defaultTimeout);
const screenshotDir = process.env.SELENIUM_SCREENSHOT_DIR || "selenium/screenshots";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const autoStartLocalStack = process.env.SELENIUM_AUTO_START_LOCAL_STACK !== "false";
// Dev server Next.js mengompilasi halaman saat pertama diminta, sehingga `/login`
// bisa butuh belasan detik walau stack-nya sehat. Batas yang terlalu pendek
// membuat probe menyimpulkan frontend mati lalu memicu `docker compose up
// --build` yang memakan belasan menit dan menutupi keadaan sebenarnya.
const probeTimeout = Number(process.env.SELENIUM_PROBE_TIMEOUT_MS || 20_000);
// Sebagian endpoint (mis. pembuatan pengguna) dapat memakan lebih dari 20 detik,
// sedangkan batas bawaan `executeAsyncScript` hanya 30 detik. Tanpa penyesuaian
// ini panggilan API lewat browser gagal dengan ScriptTimeoutError, bukan karena
// aplikasinya salah.
export const scriptTimeout = Number(process.env.SELENIUM_SCRIPT_TIMEOUT_MS || 120_000);
// Perpindahan halaman pada App Router baru mengubah URL setelah payload rute
// selesai diambil. Pada dev server yang masih sibuk, satu perpindahan terukur
// belasan detik sehingga batas umum 20 detik menghasilkan kegagalan yang
// berpindah-pindah rute setiap run. Batas navigasi karena itu dipisahkan.
export const navigationTimeout = Number(
  process.env.SELENIUM_NAVIGATION_TIMEOUT_MS || Math.max(timeout, 90_000),
);
const composeArgs = [
  "compose",
  "-f",
  "docker/compose.yml",
  "-f",
  "docker/compose.override.yml",
];

if (existsSync(path.resolve(repoRoot, ".docker.env"))) {
  composeArgs.push("--env-file", ".docker.env");
}

export async function waitForApplication() {
  const probe = async () => {
    let lastError;
    let frontendOk = false;
    let backendOk = false;
    let backendReachable = false;

    try {
      const [frontend, backend] = await Promise.all([
        fetch(`${baseUrl}/login`, { signal: AbortSignal.timeout(probeTimeout) }),
        fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(probeTimeout) }),
      ]);
      frontendOk = frontend.ok;
      // `/api/health` tetap membalas HTTP 200 saat berstatus DEGRADED (mis.
      // database tidak terhubung). Tanpa memeriksa isi respons, suite berjalan
      // di atas backend yang tidak dapat melayani data: sesi login terhapus
      // begitu ada endpoint membalas 401 dan seluruh test setelahnya gagal
      // dengan pesan yang menyesatkan.
      backendReachable = backend.ok;
      const health = backend.ok ? await backend.json().catch(() => null) : null;
      const databaseStatus = health?.services?.database ?? "unknown";
      backendOk = backendReachable && databaseStatus === "up";
      if (frontendOk && backendOk) {
        return { ready: true, frontendOk, backendOk, backendReachable, lastError: null };
      }
      lastError = new Error(
        `Frontend HTTP ${frontend.status}, backend HTTP ${backend.status}, database: ${databaseStatus}`,
      );
    } catch (error) {
      lastError = error;
    }

    return { ready: false, frontendOk, backendOk, backendReachable, lastError };
  };

  const initialProbe = await probe();
  if (initialProbe.ready) return;

  if (autoStartLocalStack) {
    // Backend yang sudah menjawab tetapi berstatus DEGRADED tidak boleh memicu
    // start container: masalahnya ada pada backend yang sedang berjalan
    // (biasanya database), dan menambah instance kedua hanya menutupi penyebab.
    await startLocalStack({
      startFrontend: !initialProbe.frontendOk,
      startBackend: !initialProbe.backendReachable,
    });
  }

  const deadline = Date.now() + timeout + (autoStartLocalStack ? timeout : 0);
  let lastError = initialProbe.lastError;

  while (Date.now() < deadline) {
    const result = await probe();
    if (result.ready) return;
    lastError = result.lastError;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(
    `SIPENA belum siap di ${baseUrl}. Jalankan stack Docker Compose terlebih dahulu atau set \`SELENIUM_AUTO_START_LOCAL_STACK=false\` jika stack sudah aktif. ${lastError instanceof Error ? lastError.message : ""}`,
  );
}

async function startLocalStack({ startFrontend, startBackend }) {
  if (!startFrontend && !startBackend) return;

  const services = [];
  if (startBackend) services.push("backend");
  if (startFrontend) services.push("frontend");

  await execFileAsync("docker", [...composeArgs, "up", "--build", "-d", ...services], {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
}

/**
 * Memaksa Next.js dev server mengompilasi setiap rute lebih dulu.
 *
 * Pada mode dev, rute baru dikompilasi saat pertama diminta dan itu bisa
 * memakan puluhan detik (terukur 35s untuk /returns dan 85s untuk /reports di
 * mesin dev). Tanpa pemanasan ini, kompilasi tersebut masuk ke hitungan
 * `waitForPath` sehingga test gagal sebagai "Halaman tidak berpindah" padahal
 * fiturnya sehat.
 *
 * Dua hal penting agar pemanasan benar-benar berguna:
 *
 * 1. Dokumen HTML dan payload navigasi klien adalah dua hasil kompilasi yang
 *    berbeda. Memuat HTML saja membuat `driver.get` cepat tetapi navigasi lewat
 *    klik menu tetap menunggu kompilasi payload (terukur 35s pada rute yang
 *    dokumennya sudah panas, lalu 0,1s setelah payloadnya ikut dipanaskan).
 *    Karena itu setiap rute diminta dua kali: sekali biasa, sekali dengan
 *    header `RSC`.
 * 2. Pemanasan dijalankan berurutan. Permintaan paralel membuat dev server
 *    mengompilasi banyak rute sekaligus, dan request API aplikasi yang lewat
 *    server yang sama ikut kehabisan waktu sehingga halaman tampil tanpa data.
 *
 * Kegagalan request diabaikan: pemanasan hanya optimasi, bukan asersi.
 */
export async function warmUpRoutes(paths, { concurrency = 1, timeoutMs = 180_000 } = {}) {
  const queue = [...new Set(paths)];

  const request = async (pathname, headers) => {
    try {
      const response = await fetch(`${baseUrl}${pathname}`, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.arrayBuffer();
    } catch {
      // Biarkan test yang melaporkan masalah rutenya.
    }
  };

  const worker = async () => {
    while (queue.length > 0) {
      const pathname = queue.shift();
      if (!pathname) return;
      await request(pathname, undefined);
      await request(pathname, { RSC: "1" });
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}

export async function createDriver() {
  const options = new chrome.Options();

  if (process.env.SELENIUM_HEADLESS !== "false") {
    options.addArguments("--headless=new");
  }

  options.addArguments(
    "--window-size=1366,768",
    "--disable-dev-shm-usage",
    "--no-sandbox",
  );

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  await driver.manage().setTimeouts({ script: scriptTimeout });

  return driver;
}

export async function openPath(driver, pathname) {
  await driver.get(`${baseUrl}${pathname}`);
  await driver.wait(until.urlContains(pathname), navigationTimeout);
}

export async function waitForPath(driver, expectedPath, waitTimeout = navigationTimeout) {
  let lastPath = "";
  try {
    await driver.wait(async () => {
      lastPath = new URL(await driver.getCurrentUrl()).pathname;
      return lastPath === expectedPath;
    }, waitTimeout);
  } catch (error) {
    // Pesan bawaan hanya menyebut batas waktu. Menyertakan halaman yang sedang
    // terbuka membedakan "navigasi lambat" dari "klik mendarat di menu lain".
    throw new Error(
      `Halaman tidak berpindah ke ${expectedPath} (masih di ${lastPath || "tidak diketahui"}): ${error.message}`,
    );
  }
}

async function takeFullPageScreenshot(driver) {
  const metrics = await driver.sendAndGetDevToolsCommand("Page.getLayoutMetrics", {});
  const contentSize = metrics.cssContentSize || metrics.contentSize;
  const width = Math.max(1, Math.ceil(contentSize.width));
  const height = Math.max(1, Math.ceil(contentSize.height));
  const result = await driver.sendAndGetDevToolsCommand("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });

  return result.data;
}

export async function saveScreenshot(driver, testName, status = "result", options = {}) {
  const outputDir = path.resolve(screenshotDir);
  await mkdir(outputDir, { recursive: true });
  const safeName = testName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const screenshot = options.fullPage
    ? await takeFullPageScreenshot(driver)
    : await driver.takeScreenshot();
  const outputPath = path.join(outputDir, `${safeName}-${status}.png`);
  await writeFile(outputPath, screenshot, "base64");
  return outputPath;
}

export async function runWithBrowser(testName, scenario) {
  const driver = await createDriver();

  try {
    await scenario(driver);
    await saveScreenshot(driver, testName, "pass");
  } catch (error) {
    await saveScreenshot(driver, testName, "fail");
    throw error;
  } finally {
    await driver.quit();
  }
}
