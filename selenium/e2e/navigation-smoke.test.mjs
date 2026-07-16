import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { By, until } from "selenium-webdriver";
import {
  baseUrl,
  createDriver,
  openPath,
  saveScreenshot,
  timeout,
  waitForApplication,
  waitForPath,
} from "../support/browser.mjs";
import { adminPassword, adminUsername } from "../support/config.mjs";

const routes = [
  ["Dashboard", "/"],
  ["Aset medis", "/medical-assets"],
  ["Aset non-medis", "/non-medical-assets"],
  ["Penggunaan aset", "/asset-usage"],
  ["Peminjaman", "/borrowing"],
  ["Pengembalian", "/returns"],
  ["Pemeliharaan", "/maintenance"],
  ["Jadwal pemeliharaan", "/maintenance-schedule"],
  ["Penghapusan", "/disposal"],
  ["SPK prioritas", "/dss"],
  ["Laporan", "/reports"],
  ["Sanksi", "/sanctions"],
  ["Arsip aktivitas", "/activity-archive"],
  ["Pengguna", "/users"],
  ["Unggahan", "/unggahan"],
  ["Pengaturan", "/settings"],
];

let driver;

before(async () => {
  await waitForApplication();
  driver = await createDriver();
  await openPath(driver, "/login");
  await driver.findElement(By.id("nip")).sendKeys(adminUsername);
  await driver.findElement(By.id("password")).sendKeys(adminPassword);
  await driver.findElement(By.xpath('//button[normalize-space()="Masuk"]')).click();
  await waitForPath(driver, "/");
});

after(async () => {
  if (driver) await driver.quit();
});

for (const [name, pathname] of routes) {
  test(`Halaman ${name} dapat dibuka`, async () => {
    try {
      await driver.get(`${baseUrl}${pathname}`);
      await driver.wait(until.elementLocated(By.css("body")), timeout);
      await driver.wait(async () => new URL(await driver.getCurrentUrl()).pathname === pathname, timeout);
      const bodyText = await driver.findElement(By.css("body")).getText();
      assert.ok(bodyText.trim().length > 0, `Halaman ${pathname} kosong`);
      assert.doesNotMatch(bodyText, /404|page not found/i);
      await saveScreenshot(driver, `smoke-${name}`, "pass");
    } catch (error) {
      await saveScreenshot(driver, `smoke-${name}`, "fail");
      throw error;
    }
  });
}
