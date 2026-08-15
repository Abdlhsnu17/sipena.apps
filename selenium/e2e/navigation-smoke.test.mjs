import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { By, until } from "selenium-webdriver";
import {
  createDriver,
  navigationTimeout,
  openPath,
  saveScreenshot,
  timeout,
  waitForApplication,
  waitForPath,
  warmUpRoutes,
} from "../support/browser.mjs";
import { ensureTestAdmin } from "../support/bootstrap-admin.mjs";
import { createAssetStatusScenarios } from "../support/asset-status-scenarios.mjs";
import { adminPassword, adminUsername } from "../support/config.mjs";

// Kontrak tampilan utama setiap fitur. Test tidak cukup hanya memastikan halaman
// tidak kosong: judul dan label fitur/kolom penting juga harus tetap tersedia.
const routes = [
  {
    name: "Arsip & Riwayat",
    pathname: "/activity-archive",
    heading: "Arsip & Riwayat",
    expectedTexts: ["Semua user"],
  },
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
    name: "Laporan & Analitik",
    pathname: "/reports",
    heading: "Laporan & Analitik",
    expectedTexts: ["Ekspor Laporan", "Inventaris Terinput", "Pemeliharaan"],
  },
  {
    name: "Manajemen Pengguna",
    pathname: "/users",
    heading: "Manajemen Pengguna",
    expectedTexts: ["Data Pengguna", "Unit Kerja", "Tambah Pengguna"],
  },
  {
    name: "Manajemen Sanksi",
    pathname: "/sanctions",
    heading: "Manajemen Sanksi",
    expectedTexts: ["Daftar Manajemen Sanksi", "Cari No ID, aset, nama, atau NIP"],
  },
  {
    name: "Pemeliharaan Sarana",
    pathname: "/maintenance",
    heading: "Pemeliharaan Sarana",
    expectedTexts: ["Kalender Pemeliharaan", "Daftar Pemeliharaan Sarana", "Riwayat Pemeliharaan Sarana"],
  },
  {
    name: "Peminjaman",
    pathname: "/borrowing",
    heading: "Peminjaman",
    expectedTexts: ["Daftar Peminjaman", "Cari No ID, aset, atau peminjam"],
  },
  {
    name: "Pengaturan",
    pathname: "/settings",
    heading: "Pengaturan",
    expectedTexts: ["Profil Akun", "Ganti Sandi", "Informasi Sistem"],
  },
  {
    name: "Pengembalian",
    pathname: "/returns",
    heading: "Pengembalian",
    expectedTexts: ["Alat yang Perlu Dikembalikan", "Riwayat Pengembalian"],
  },
  {
    name: "Penggunaan",
    pathname: "/asset-usage",
    heading: "Penggunaan",
    expectedTexts: ["Riwayat Pemakaian", "Cari No ID, aset, atau operator"],
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
    name: "Unggah Dokumen",
    pathname: "/unggahan",
    heading: "Unggah Dokumen",
    expectedTexts: ["Keterangan dokumen", "Riwayat Dokumen"],
  },
];

const runId = `${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

let driver;

// Aturan penguncian status aset dipakai bersama dengan suite regresi penuh agar
// keduanya memverifikasi perilaku yang sama persis.
const statusScenarios = createAssetStatusScenarios({
  getDriver: () => driver,
  runId,
  openFeaturePath: async (pathname) => {
    await openPath(driver, pathname);
    await driver.wait(until.elementLocated(By.css("body")), timeout);
  },
});

before(async () => {
  await waitForApplication();
  await ensureTestAdmin();
  await warmUpRoutes(["/login", ...routes.map((route) => route.pathname)]);
  driver = await createDriver();
});

after(async () => {
  try {
    await statusScenarios.cleanup();
  } finally {
    if (driver) await driver.quit();
  }
});

// Urutan pengujian mengikuti alur nyata pengguna: login lebih dulu, lalu
// menjelajah seluruh fitur sesuai alur menu pada regresi penuh, dan diakhiri
// dengan logout.
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

// Pencarian dibatasi pada daftar menu sidebar. Tanpa batasan ini, pintasan pada
// dashboard yang menunjuk ke rute yang sama ikut terpilih sehingga test mengklik
// elemen lain daripada menu yang sedang diuji.
async function findSidebarLink(pathname, menuName) {
  const links = await driver.findElements(By.css(`[data-sidebar-nav] a[href="${pathname}"]`));
  let fallback = null;

  for (const candidate of links) {
    if (!(await candidate.isDisplayed())) continue;
    const text = normalizeText(await candidate.getText());
    if (text === normalizeText(menuName)) return candidate;
    if (!fallback) fallback = candidate;
  }

  return fallback;
}

// Setiap test menu berangkat dari halaman yang ditinggalkan test sebelumnya.
// Bila test sebelumnya berhenti pada keadaan tanpa sidebar, kembalikan dulu ke
// dashboard supaya kegagalan tidak menular ke menu berikutnya.
async function ensureSidebarReady(pathname, menuName) {
  let link = await findSidebarLink(pathname, menuName);
  if (link) return link;

  await openPath(driver, "/");
  await driver.wait(
    async () => Boolean(await findSidebarLink(pathname, menuName)),
    timeout,
    `Menu sidebar untuk ${pathname} tidak muncul setelah kembali ke dashboard`,
  );
  link = await findSidebarLink(pathname, menuName);
  assert.ok(link, `Menu sidebar untuk ${pathname} tidak ditemukan atau tidak terlihat`);
  return link;
}

async function navigateByFeatureClick(pathname, menuName) {
  // Sidebar memulihkan posisi gulir daftar menu beberapa saat setelah rute
  // berganti. Klik yang jatuh tepat pada saat itu dapat kehilangan sasarannya,
  // karena itu percobaan kedua mencari ulang elemennya sebelum menyerah.
  const attempts = 2;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const link = await ensureSidebarReady(pathname, menuName);
    try {
      await driver.executeScript(
        "arguments[0].scrollIntoView({block: 'center', inline: 'nearest'})",
        link,
      );
      await driver.wait(until.elementIsEnabled(link), timeout);
      await link.click();
      await waitForPath(driver, pathname);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      await openPath(driver, "/");
    }
  }
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

// Setelah seluruh menu terbukti dapat dibuka, jalankan verifikasi aturan
// penguncian status aset dari modul bersama.
statusScenarios.scenarios.forEach((statusScenario) => {
  test(`Aturan status aset: ${statusScenario.title}`, async () => {
    try {
      await statusScenario.run();
      await openPath(driver, statusScenario.evidencePath);
      await saveScreenshot(driver, `smoke-${statusScenario.key}`, "pass");
    } catch (error) {
      await saveScreenshot(driver, `smoke-${statusScenario.key}`, "fail");
      throw error;
    }
  });
});

test("Bersihkan data uji aturan status aset", async () => {
  await statusScenarios.cleanup();
});

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
