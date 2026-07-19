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

// Kontrak tampilan utama setiap fitur. Test tidak cukup hanya memastikan halaman
// tidak kosong: judul dan label fitur/kolom penting juga harus tetap tersedia.
const routes = [
  {
    name: "Dashboard",
    pathname: "/",
    expectedTexts: ["Inventaris Non Medis", "Inventaris Medis", "Peminjaman Aktif", "Pemeliharaan Sarana"],
  },
  {
    name: "Dokumentasi Sistem",
    pathname: "/uml",
    heading: "Dokumentasi Sistem",
    expectedTexts: ["Activity Diagram", "Use Case Diagram"],
  },
  {
    name: "Inventaris Medis",
    pathname: "/medical-assets",
    heading: "Inventaris Medis",
    expectedTexts: ["Cari No ID, ruangan, nama alat, kode barang"],
  },
  {
    name: "Inventaris Non-Medis",
    pathname: "/non-medical-assets",
    heading: "Inventaris Non-Medis",
    expectedTexts: ["Cari No ID, ruangan, nama alat, kode barang"],
  },
  {
    name: "Penggunaan",
    pathname: "/asset-usage",
    heading: "Penggunaan",
    expectedTexts: ["Riwayat Pemakaian", "Cari No ID, aset, atau operator"],
  },
  {
    name: "Peminjaman",
    pathname: "/borrowing",
    heading: "Peminjaman",
    expectedTexts: ["Daftar Peminjaman", "Cari No ID, aset, atau peminjam"],
  },
  {
    name: "Pengembalian",
    pathname: "/returns",
    heading: "Pengembalian",
    expectedTexts: ["Alat yang Perlu Dikembalikan", "Riwayat Pengembalian"],
  },
  {
    name: "Pemeliharaan Sarana",
    pathname: "/maintenance",
    heading: "Pemeliharaan Sarana",
    expectedTexts: ["Kalender Pemeliharaan", "Daftar Pemeliharaan Sarana", "Riwayat Pemeliharaan Sarana"],
  },
  {
    name: "Jadwal Pemeliharaan",
    pathname: "/maintenance-schedule",
    heading: "Jadwal Pemeliharaan",
    expectedTexts: ["Tambah jadwal", "ID aset", "Deskripsi", "Daftar jadwal"],
  },
  {
    name: "Penghapusan Aset",
    pathname: "/disposal",
    heading: "Permintaan Penghapusan Aset",
    expectedTexts: ["Cari aset, kode, pengaju"],
  },
  {
    name: "SPK Prioritas Aset",
    pathname: "/dss",
    heading: "SPK Prioritas Aset",
    expectedTexts: ["Ringkasan Prioritas", "Top Ranking", "Metode TOPSIS"],
  },
  {
    name: "Laporan & Analitik",
    pathname: "/reports",
    heading: "Laporan & Analitik",
    expectedTexts: ["Ekspor Laporan", "Inventaris Terinput", "Pemeliharaan"],
  },
  {
    name: "Manajemen Sanksi",
    pathname: "/sanctions",
    heading: "Manajemen Sanksi",
    expectedTexts: ["Daftar Manajemen Sanksi", "Cari No ID, aset, nama, atau NIP"],
  },
  {
    name: "Arsip & Riwayat",
    pathname: "/activity-archive",
    heading: "Arsip & Riwayat",
    expectedTexts: ["Semua user"],
  },
  {
    name: "Manajemen Pengguna",
    pathname: "/users",
    heading: "Manajemen Pengguna",
    expectedTexts: ["Data Pengguna", "Unit Kerja", "Tambah Pengguna"],
  },
  {
    name: "Unggah Dokumen",
    pathname: "/unggahan",
    heading: "Unggah Dokumen",
    expectedTexts: ["Keterangan dokumen", "Riwayat Dokumen"],
  },
  {
    name: "Pengaturan",
    pathname: "/settings",
    heading: "Pengaturan",
    expectedTexts: ["Profil Akun", "Ganti Sandi", "Informasi Sistem"],
  },
].sort((left, right) => left.name.localeCompare(right.name, "id"));

let driver;

before(async () => {
  await waitForApplication();
  driver = await createDriver();
});

after(async () => {
  if (driver) await driver.quit();
});

// Urutan pengujian mengikuti alur nyata pengguna: login lebih dulu, lalu
// menjelajah seluruh fitur (diurutkan abjad), dan diakhiri dengan logout.
test("Login dengan akun admin", async () => {
  try {
    await openPath(driver, "/login");
    const nipInput = await driver.wait(until.elementLocated(By.id("nip")), timeout);
    await driver.wait(until.elementIsVisible(nipInput), timeout);
    await nipInput.sendKeys(adminUsername);
    await driver.findElement(By.id("password")).sendKeys(adminPassword);
    await saveScreenshot(driver, "smoke-Login", "pass");
    await driver.findElement(By.xpath('//button[normalize-space()="Masuk"]')).click();
    await waitForPath(driver, "/");
  } catch (error) {
    await saveScreenshot(driver, "smoke-Login", "fail");
    throw error;
  }
});

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("id-ID");
}

async function getPageContractText() {
  return driver.executeScript(() => {
    const bodyText = document.body?.innerText || "";
    const attributeText = Array.from(
      document.querySelectorAll("input, textarea, select, [aria-label], [title]"),
    ).flatMap((element) => [
      element.getAttribute("placeholder"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
    ]).filter(Boolean);

    return [bodyText, ...attributeText].join("\n");
  });
}

async function navigateByFeatureClick(pathname, menuName) {
  const links = await driver.findElements(By.css(`a[href="${pathname}"]`));
  let link = null;
  for (const candidate of links) {
    if (await candidate.isDisplayed()) {
      const text = normalizeText(await candidate.getText());
      if (text === normalizeText(menuName)) {
        link = candidate;
        break;
      }
      if (!link && text) link = candidate;
    }
  }

  assert.ok(link, `Menu sidebar untuk ${pathname} tidak ditemukan atau tidak terlihat`);
  await driver.executeScript(
    "arguments[0].scrollIntoView({block: 'center', inline: 'nearest'})",
    link,
  );
  await driver.wait(until.elementIsEnabled(link), timeout);
  await link.click();
  await waitForPath(driver, pathname);
}

for (const { name, pathname, heading, expectedTexts } of routes) {
  test(`Menu ${name} dapat diklik dan fitur utamanya tampil`, async () => {
    try {
      await navigateByFeatureClick(pathname, name);
      await driver.wait(until.elementLocated(By.css("body")), timeout);

      if (heading) {
        await driver.wait(async () => {
          const headings = await driver.findElements(By.css("h1"));
          const headingTexts = await Promise.all(headings.map((element) => element.getText()));
          return headingTexts.some((text) => normalizeText(text) === normalizeText(heading));
        }, timeout, `Judul halaman "${heading}" tidak ditemukan`);
      }

      await driver.wait(async () => {
        const text = normalizeText(await getPageContractText());
        return expectedTexts.every((expected) => text.includes(normalizeText(expected)));
      }, timeout, `Fitur/kolom wajib halaman ${pathname} tidak lengkap`);

      const bodyText = await getPageContractText();
      assert.ok(bodyText.trim().length > 0, `Halaman ${pathname} kosong`);
      assert.doesNotMatch(bodyText, /404|page not found/i);
      for (const expected of expectedTexts) {
        assert.ok(
          normalizeText(bodyText).includes(normalizeText(expected)),
          `Fitur/kolom "${expected}" tidak ditemukan pada ${pathname}`,
        );
      }
      await saveScreenshot(driver, `smoke-${name}`, "pass");
    } catch (error) {
      await saveScreenshot(driver, `smoke-${name}`, "fail");
      throw error;
    }
  });
}

test("Logout dari sistem", async () => {
  try {
    const logoutButton = await driver.wait(
      until.elementLocated(
        By.xpath('//button[contains(normalize-space(), "Keluar") or contains(normalize-space(), "Logout")]'),
      ),
      timeout,
    );
    await driver.wait(until.elementIsVisible(logoutButton), timeout);
    await logoutButton.click();
    await waitForPath(driver, "/login");

    const token = await driver.executeScript(
      "return localStorage.getItem('token') || sessionStorage.getItem('token')",
    );
    assert.equal(token, null, "Token sesi masih tersimpan setelah logout");
    await saveScreenshot(driver, "smoke-Logout", "pass");
  } catch (error) {
    await saveScreenshot(driver, "smoke-Logout", "fail");
    throw error;
  }
});
