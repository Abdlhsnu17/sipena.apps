import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Builder, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

export const baseUrl = (process.env.SELENIUM_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
export const timeout = Number(process.env.SELENIUM_TIMEOUT_MS || 20_000);
const screenshotDir = process.env.SELENIUM_SCREENSHOT_DIR || "selenium/screenshots";

export async function waitForApplication() {
  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const [frontend, backend] = await Promise.all([
        fetch(`${baseUrl}/login`, { signal: AbortSignal.timeout(3_000) }),
        fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3_000) }),
      ]);
      if (frontend.ok && backend.ok) return;
      lastError = new Error(`Frontend HTTP ${frontend.status}, backend HTTP ${backend.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(
    `SIPENA belum siap di ${baseUrl}. Jalankan frontend dan backend terlebih dahulu. ${lastError instanceof Error ? lastError.message : ""}`,
  );
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

  return new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();
}

export async function openPath(driver, pathname) {
  await driver.get(`${baseUrl}${pathname}`);
  await driver.wait(until.urlContains(pathname), timeout);
}

export async function waitForPath(driver, expectedPath) {
  await driver.wait(async () => {
    const currentPath = new URL(await driver.getCurrentUrl()).pathname;
    return currentPath === expectedPath;
  }, timeout, `Halaman tidak berpindah ke ${expectedPath}`);
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
