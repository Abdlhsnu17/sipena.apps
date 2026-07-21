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

const runId = `${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
const configuredEvidenceDelay = Number(process.env.SELENIUM_EVIDENCE_DELAY_MS);
const evidenceDelayMs = Number.isFinite(configuredEvidenceDelay)
  ? Math.max(0, configuredEvidenceDelay)
  : process.env.SELENIUM_HEADLESS === "false" ? 2_500 : 0;
const configuredStepDelay = Number(process.env.SELENIUM_STEP_DELAY_MS);
const stepDelayMs = Number.isFinite(configuredStepDelay)
  ? Math.max(0, configuredStepDelay)
  : process.env.SELENIUM_HEADLESS === "false" ? 600 : 0;
const normalUser = {
  nip: `E2E${Date.now().toString().slice(-13)}`,
  password: "E2eUserTest123",
  email: `selenium-${runId}@example.invalid`,
  phoneNumber: `08${Date.now().toString().slice(-10)}`,
};
const asset = {
  assetCode: `SEL-AST-${runId}`,
  name: `Aset Selenium ${runId}`,
  category: "Peralatan Uji",
  type: "medical",
  status: "available",
  condition: "good",
};

const state = {
  admin: null,
  user: null,
  assetId: 0,
  disposableAssetId: 0,
  rejectionAssetId: 0,
  overdueAssetId: 0,
  timelyBorrowingId: 0,
  maintenanceId: 0,
  borrowingIds: [],
};

let driver;

before(async () => {
  await waitForApplication();
  driver = await createDriver();
});

after(async () => {
  try {
    await cleanupCreatedData();
  } finally {
    if (driver) await driver.quit();
  }
});

function assertStatus(response, expected) {
  assert.equal(
    response.status,
    expected,
    `Status ${response.status}, respons: ${JSON.stringify(response.body)}`,
  );
}

function extractRows(response) {
  if (Array.isArray(response.body)) return response.body;
  if (Array.isArray(response.body?.data)) return response.body.data;
  return [];
}

async function api(method, endpoint, token, body) {
  return driver.executeAsyncScript(
    function request(methodArg, endpointArg, tokenArg, bodyArg, done) {
      const headers = {};
      if (bodyArg !== null) headers["Content-Type"] = "application/json";
      if (tokenArg) headers.Authorization = `Bearer ${tokenArg}`;

      fetch(endpointArg, {
        method: methodArg,
        headers,
        body: bodyArg === null ? undefined : JSON.stringify(bodyArg),
      })
        .then(async (response) => {
          const raw = await response.text();
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }
          done({ status: response.status, body: parsed });
        })
        .catch((error) => done({ status: 0, body: { message: error.message } }));
    },
    method,
    `/api${endpoint}`,
    token || null,
    body ?? null,
  );
}

async function cleanupCreatedData() {
  const token = state.admin?.token;
  if (!driver || !token) return;

  const safeApi = async (method, endpoint, body = null) => {
    try {
      await api(method, endpoint, token, body);
    } catch {
      // Cleanup bersifat best-effort agar kegagalan asli tetap terlihat.
    }
  };

  if (state.maintenanceId) {
    await safeApi("DELETE", `/maintenance/${state.maintenanceId}`, {
      deleteReason: "Pembersihan data Selenium",
    });
    state.maintenanceId = 0;
  }

  for (const id of [...state.borrowingIds].reverse()) {
    await safeApi("DELETE", `/borrowing/${id}`);
  }
  state.borrowingIds = [];

  if (state.user?.user?.id) {
    await safeApi("DELETE", `/users/${state.user.user.id}`, {
      deleteReason: "Pembersihan data Selenium",
    });
    state.user = null;
  }

  const assetIds = [
    state.assetId,
    state.disposableAssetId,
    state.rejectionAssetId,
    state.overdueAssetId,
  ].filter(Boolean);
  for (const id of assetIds) {
    await safeApi("DELETE", `/assets/${id}?type=medical`);
  }
  state.assetId = 0;
  state.disposableAssetId = 0;
  state.rejectionAssetId = 0;
  state.overdueAssetId = 0;
}

async function showEvidence(title, detail, passed) {
  await driver.executeScript(
    function render(titleArg, detailArg, passedArg) {
      document.getElementById("selenium-evidence")?.remove();

      const panel = document.createElement("section");
      panel.id = "selenium-evidence";
      panel.style.cssText = [
        "position:fixed",
        "left:50%",
        "top:50%",
        "transform:translate(-50%,-50%)",
        "z-index:2147483647",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "width:min(460px,44vw)",
        "min-width:320px",
        "box-sizing:border-box",
        "pointer-events:none",
        "font-family:Arial,sans-serif",
      ].join(";");
      const card = document.createElement("div");
      card.style.cssText = [
        "width:100%",
        "box-sizing:border-box",
        "padding:14px 16px",
        "border-radius:14px",
        "background:rgba(255,255,255,.97)",
        `border:3px solid ${passedArg ? "#16a34a" : "#dc2626"}`,
        "box-shadow:0 12px 36px rgba(15,23,42,.24)",
        "color:#0f172a",
      ].join(";");
      const status = document.createElement("div");
      status.style.cssText = `font-size:12px;font-weight:700;color:${passedArg ? "#15803d" : "#b91c1c"}`;
      status.textContent = passedArg ? "LULUS" : "GAGAL";
      const heading = document.createElement("h1");
      heading.style.cssText = "font-size:18px;margin:4px 0 8px";
      heading.textContent = titleArg;
      const detail = document.createElement("pre");
      detail.style.cssText = "max-height:110px;overflow:auto;white-space:pre-wrap;font-size:12px;line-height:1.45;background:#f1f5f9;padding:9px 11px;border-radius:8px;margin:0";
      detail.textContent = detailArg;
      card.append(status, heading, detail);
      panel.appendChild(card);
      document.body.appendChild(panel);
    },
    title,
    detail,
    passed,
  );
}

async function pauseForEvidence() {
  if (evidenceDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, evidenceDelayMs));
  }
}

async function clearEvidence() {
  if (!driver) return;
  try {
    await driver.executeScript(
      "document.getElementById('selenium-evidence')?.remove()",
    );
  } catch {
    // Navigasi dapat mengganti document tepat saat panel dibersihkan.
  }
}

async function pauseStep(multiplier = 1) {
  const duration = Math.round(stepDelayMs * multiplier);
  if (duration > 0) {
    await new Promise((resolve) => setTimeout(resolve, duration));
  }
}

async function openEvidencePath(pathname) {
  if (!pathname) return;

  try {
    await driver.get(`${baseUrl}${pathname}`);
    await driver.wait(until.elementLocated(By.css("body")), timeout);
    await driver.wait(async () => {
      const readyState = await driver.executeScript("return document.readyState");
      return readyState === "interactive" || readyState === "complete";
    }, timeout);
    await pauseStep();
  } catch {
    // Abaikan kegagalan navigasi agar verifikasi utama tetap berjalan.
  }
}

function scenario(number, title, evidencePath, callback) {
  const screenshotName = `${String(number).padStart(2, "0")}-${title}`;
  test(title, async () => {
    await clearEvidence();
    try {
      const detail = await callback();
      await openEvidencePath(evidencePath);
      await showEvidence(title, detail || "Skenario berhasil diverifikasi.", true);
      await saveScreenshot(driver, screenshotName, "pass", { fullPage: true });
      await pauseForEvidence();
      await clearEvidence();
      await pauseStep(0.5);
    } catch (error) {
      await openEvidencePath(evidencePath);
      try {
        await showEvidence(title, error instanceof Error ? error.message : String(error), false);
        await saveScreenshot(driver, screenshotName, "fail", { fullPage: true });
        await pauseForEvidence();
        await clearEvidence();
        await pauseStep(0.5);
      } catch {
        // Pertahankan error skenario asli bila browser sudah tidak dapat mengambil screenshot.
      }
      throw error;
    }
  });
}

async function clickVisibleByXpath(xpath, description) {
  const element = await driver.wait(async () => {
    const candidates = await driver.findElements(By.xpath(xpath));
    for (const candidate of candidates) {
      if (await candidate.isDisplayed()) return candidate;
    }
    return null;
  }, timeout, `${description} tidak ditemukan atau tidak terlihat`);

  await driver.executeScript(
    "arguments[0].scrollIntoView({block: 'center', inline: 'nearest'})",
    element,
  );
  await driver.wait(until.elementIsEnabled(element), timeout);
  await element.click();
  await pauseStep();
  return element;
}

async function clickButton(label) {
  return clickVisibleByXpath(
    `//button[normalize-space(.)=${JSON.stringify(label)}]`,
    `Tombol "${label}"`,
  );
}

async function clickTab(label) {
  const tab = await clickVisibleByXpath(
    `//*[@role="tab" and normalize-space(.)=${JSON.stringify(label)}]`,
    `Tab "${label}"`,
  );
  await driver.wait(async () => (
    (await tab.getAttribute("aria-selected")) === "true"
    || (await tab.getAttribute("data-state")) === "active"
  ), timeout, `Tab "${label}" tidak menjadi aktif setelah diklik`);
}

async function expectVisibleText(text) {
  await driver.wait(async () => {
    const bodyText = await driver.findElement(By.css("body")).getText();
    return bodyText.replace(/\s+/g, " ").includes(text);
  }, timeout, `Teks "${text}" tidak tampil`);
}

async function submitLogin(username, password) {
  const usernameInput = await driver.wait(until.elementLocated(By.id("nip")), timeout);
  const passwordInput = await driver.wait(until.elementLocated(By.id("password")), timeout);
  await usernameInput.clear();
  await passwordInput.clear();
  if (username) await usernameInput.sendKeys(username);
  if (password) await passwordInput.sendKeys(password);
  await pauseStep(0.75);
  await driver.findElement(By.xpath('//button[normalize-space()="Masuk"]')).click();
  await pauseStep();
}

async function waitForLoginError(pattern, description) {
  await driver.wait(async () => {
    const bodyText = await driver.findElement(By.css("body")).getText();
    return pattern.test(bodyText);
  }, timeout, description);
}

async function readBrowserSession() {
  return driver.executeScript(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const rawUser = localStorage.getItem("user")
      || localStorage.getItem("hospital_current_user")
      || sessionStorage.getItem("user");
    return { token, user: rawUser ? JSON.parse(rawUser) : null };
  });
}

async function createAuxiliaryAsset(suffix, name) {
  const response = await api("POST", "/assets", state.admin.token, {
    ...asset,
    assetCode: `${asset.assetCode}-${suffix}`,
    name,
  });
  assertStatus(response, 201);
  assert.equal(response.body.success, true);
  return Number(response.body.data.id);
}

scenario(1, "Login dengan akun valid", "/", async () => {
  await openPath(driver, "/login");
  await submitLogin(adminUsername, adminPassword);
  await waitForPath(driver, "/");

  const session = await readBrowserSession();
  assert.ok(session.token);
  assert.equal(session.user?.role, "admin", "Akun pengujian harus memiliki role admin");
  state.admin = session;
  return `NIP: ${adminUsername}\nRole: ${session.user.role}\nDashboard berhasil dibuka.`;
});

scenario(2, "Password salah", "/login", async () => {
  const logoutButton = await driver.wait(
    until.elementLocated(By.xpath('//button[contains(normalize-space(), "Keluar") or contains(normalize-space(), "Logout")]')),
    timeout,
  );
  await driver.wait(until.elementIsVisible(logoutButton), timeout);
  await logoutButton.click();
  await pauseStep();
  await waitForPath(driver, "/login");

  await submitLogin(adminUsername, `${adminPassword}-salah`);
  await waitForLoginError(/password.*salah/i, "Pesan password salah tidak tampil");
  assert.equal(new URL(await driver.getCurrentUrl()).pathname, "/login");
  return "Validasi UI berhasil.\nPassword yang salah ditolak dan pengguna tetap di halaman login.";
});

scenario(3, "Field kosong", "/login", async () => {
  await submitLogin("", "");
  await waitForLoginError(/username atau email wajib diisi/i, "Pesan field login wajib tidak tampil");
  assert.equal(new URL(await driver.getCurrentUrl()).pathname, "/login");
  return "Validasi UI berhasil.\nField login kosong ditolak sebelum sesi dibuat.";
});

scenario(4, "Tambah user baru valid", "/users", async () => {
  await submitLogin(adminUsername, adminPassword);
  await waitForPath(driver, "/");
  const session = await readBrowserSession();
  assert.ok(session.token);
  assert.equal(session.user?.role, "admin");
  state.admin = session;

  const response = await api("POST", "/users", state.admin.token, {
    ...normalUser,
    name: "Pengguna Selenium",
    role: "user",
    staffAccessType: "all",
    gender: "Laki-laki",
    accountStatus: "active",
    mustChangePassword: false,
  });
  assertStatus(response, 201);
  assert.equal(response.body.success, true);

  const loginResponse = await api("POST", "/auth/login", null, {
    nip: normalUser.nip,
    password: normalUser.password,
  });
  assertStatus(loginResponse, 200);
  state.user = loginResponse.body.data;
  await openPath(driver, "/users");
  await expectVisibleText("Pengguna Selenium");
  return `User ${normalUser.nip} berhasil dibuat.\nRole: ${state.user.user.role}`;
});

scenario(5, "Tambah barang valid", "/medical-assets", async () => {
  const response = await api("POST", "/assets", state.admin.token, asset);
  assertStatus(response, 201);
  assert.equal(response.body.success, true);
  state.assetId = Number(response.body.data.id);
  assert.ok(state.assetId > 0);
  return `${asset.assetCode}\n${asset.name}\nID: ${state.assetId}`;
});

scenario(6, "Kode barang duplikat", "/medical-assets", async () => {
  const response = await api("POST", "/assets", state.admin.token, { ...asset, name: "Duplikat" });
  assertStatus(response, 201);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /kode aset sudah digunakan/i);
  return `HTTP ${response.status}\n${response.body.message}`;
});

scenario(7, "Edit data barang", "/medical-assets", async () => {
  const updatedName = `${asset.name} Diperbarui`;
  const response = await api("PUT", `/assets/${state.assetId}`, state.admin.token, {
    ...asset,
    name: updatedName,
  });
  assertStatus(response, 200);
  assert.equal(response.body.data.name, updatedName);
  asset.name = updatedName;
  return `ID: ${state.assetId}\nNama baru: ${updatedName}`;
});

scenario(8, "Hapus barang", "/medical-assets", async () => {
  state.disposableAssetId = await createAuxiliaryAsset("DELETE", "Aset Hapus Selenium");
  const response = await api("DELETE", `/assets/${state.disposableAssetId}?type=medical`, state.admin.token);
  assertStatus(response, 200);
  assert.equal(response.body.success, true);
  return `Aset uji ID ${state.disposableAssetId} berhasil dihapus.`;
});

scenario(9, "Pencarian barang", "/medical-assets", async () => {
  const response = await api(
    "GET",
    `/assets?search=${encodeURIComponent(asset.assetCode)}&type=medical&limit=100`,
    state.admin.token,
  );
  assertStatus(response, 200);
  const found = extractRows(response).some((item) => (item.assetCode || item.asset_code) === asset.assetCode);
  assert.equal(found, true);
  return `Kata kunci: ${asset.assetCode}\nBarang ditemukan.`;
});

scenario(10, "Ajukan peminjaman valid", "/borrowing", async () => {
  const response = await api("POST", "/borrowing", state.user.token, {
    assetId: state.assetId,
    assetType: "medical",
    borrowDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 86_400_000).toISOString(),
    purpose: "Uji Selenium",
    quantity: 1,
  });
  assertStatus(response, 201);
  assert.equal(response.body.success, true);
  state.timelyBorrowingId = Number(response.body.data.id);
  state.borrowingIds.push(state.timelyBorrowingId);
  return `Peminjaman ID ${state.timelyBorrowingId}\nStatus: ${response.body.data.status}`;
});

scenario(11, "Jumlah pinjam melebihi stok", "/borrowing", async () => {
  const response = await api("POST", "/borrowing", state.user.token, {
    assetId: state.assetId,
    assetType: "medical",
    borrowDate: new Date().toISOString(),
    purpose: "Melebihi stok",
    quantity: 2,
  });
  assert.equal(response.body.success, false);
  assert.ok([400, 409, 201].includes(response.status));
  return `HTTP ${response.status}\n${response.body.message}`;
});

scenario(12, "Setujui peminjaman", "/borrowing", async () => {
  const response = await api("PATCH", `/borrowing/${state.timelyBorrowingId}/approve`, state.admin.token);
  assertStatus(response, 200);
  assert.equal(response.body.data.status, "approved");
  return `Peminjaman ID ${state.timelyBorrowingId}\nStatus: approved`;
});

scenario(13, "Tolak peminjaman", "/borrowing", async () => {
  state.rejectionAssetId = await createAuxiliaryAsset("REJECT", "Aset Tolak Selenium");
  const created = await api("POST", "/borrowing", state.user.token, {
    assetId: state.rejectionAssetId,
    assetType: "medical",
    borrowDate: new Date().toISOString(),
    purpose: "Uji penolakan Selenium",
    quantity: 1,
  });
  assertStatus(created, 201);
  const borrowingId = Number(created.body.data.id);
  state.borrowingIds.push(borrowingId);
  const response = await api("PATCH", `/borrowing/${borrowingId}/reject`, state.admin.token, {
    reason: "Ditolak untuk pengujian Selenium",
  });
  assertStatus(response, 200);
  assert.equal(response.body.data.status, "rejected");
  return `Peminjaman ID ${borrowingId}\nStatus: rejected`;
});

scenario(14, "Kembalikan barang tepat waktu", "/returns", async () => {
  const returned = await api("PATCH", `/borrowing/${state.timelyBorrowingId}/return`, state.user.token, {
    condition: "good",
    notes: "Kembali tepat waktu",
  });
  assertStatus(returned, 200);
  assert.equal(returned.body.data.status, "returned");
  const validated = await api("PATCH", `/borrowing/${state.timelyBorrowingId}/validate-return`, state.admin.token);
  assertStatus(validated, 200);
  return `Peminjaman ID ${state.timelyBorrowingId}\nDikembalikan dan divalidasi tepat waktu.`;
});

scenario(15, "Pengembalian terlambat", "/returns", async () => {
  state.overdueAssetId = await createAuxiliaryAsset("OVERDUE", "Aset Terlambat Selenium");
  const created = await api("POST", "/borrowing", state.user.token, {
    assetId: state.overdueAssetId,
    assetType: "medical",
    borrowDate: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    dueDate: new Date(Date.now() - 86_400_000).toISOString(),
    purpose: "Uji keterlambatan Selenium",
    quantity: 1,
  });
  assertStatus(created, 201);
  const borrowingId = Number(created.body.data.id);
  state.borrowingIds.push(borrowingId);
  assertStatus(await api("PATCH", `/borrowing/${borrowingId}/approve`, state.admin.token), 200);
  const returned = await api("PATCH", `/borrowing/${borrowingId}/return`, state.user.token, {
    condition: "good",
    notes: "Kembali terlambat",
  });
  assertStatus(returned, 200);
  const overdueDays = Number(returned.body.data.overdueDays ?? returned.body.data.overdue_days ?? 0);
  assert.ok(overdueDays > 0);
  assertStatus(await api("PATCH", `/borrowing/${borrowingId}/validate-return`, state.admin.token), 200);
  return `Peminjaman ID ${borrowingId}\nTerlambat: ${overdueDays} hari.`;
});

scenario(16, "Buat pengajuan pemeliharaan", "/maintenance", async () => {
  const scheduledDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const response = await api("POST", "/maintenance", state.admin.token, {
    assetId: state.assetId,
    assetType: "medical",
    type: "preventive",
    priority: "normal",
    scheduledDate,
    description: "Pemeliharaan preventif Selenium",
  });
  assertStatus(response, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "requested");
  state.maintenanceId = Number(response.body.data.id);
  assert.ok(state.maintenanceId > 0);
  return `Pemeliharaan ID ${state.maintenanceId}\nStatus: requested\nJadwal: ${scheduledDate}`;
});

scenario(17, "Jadwalkan pemeliharaan", "/maintenance", async () => {
  const scheduledDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const response = await api("PUT", `/maintenance/${state.maintenanceId}`, state.admin.token, {
    status: "scheduled",
    scheduledDate,
  });
  assertStatus(response, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "scheduled");
  return `Pemeliharaan ID ${state.maintenanceId}\nStatus: scheduled`;
});

scenario(18, "Input karakter tidak valid", "/users", async () => {
  const response = await api("POST", "/users", state.admin.token, {
    ...normalUser,
    nip: "<script>",
    email: `invalid-${runId}@example.invalid`,
    phoneNumber: `09${Date.now().toString().slice(-10)}`,
    name: "Input Tidak Valid",
    role: "user",
  });
  assertStatus(response, 400);
  assert.equal(response.body.success, false);
  return `HTTP ${response.status}\nKarakter terlarang pada NIP ditolak.`;
});

scenario(19, "User biasa akses halaman admin", "/users", async () => {
  const response = await api("GET", "/users", state.user.token);
  assertStatus(response, 403);
  return `HTTP ${response.status}\nRole user tidak dapat mengakses data admin.`;
});

scenario(20, "Kontrol seluruh fitur dapat diklik", "/", async () => {
  const checked = [];

  await openEvidencePath("/activity-archive");
  await clickButton("Riwayat Penggunaan & Peminjaman");
  await expectVisibleText("Riwayat Penggunaan");
  await clickButton("Riwayat Peminjaman");
  await clickButton("Riwayat Penggunaan");
  await clickButton("Riwayat Aktivitas");
  checked.push("Arsip & Riwayat: aktivitas dan riwayat inventaris");

  await openEvidencePath("/");
  for (const text of ["Inventaris Non Medis", "Inventaris Medis", "Peminjaman Aktif"]) await expectVisibleText(text);
  checked.push("Dashboard: kartu ringkasan");

  await openEvidencePath("/uml");
  await clickVisibleByXpath('//*[@aria-label="Lihat Use Case Diagram"]', "Kartu Use Case Diagram");
  await expectVisibleText("Use Case Diagram");
  await clickVisibleByXpath('//*[@aria-label="Lihat Activity Diagram"]', "Kartu Activity Diagram");
  await expectVisibleText("Activity Diagram");
  checked.push("Dokumentasi Sistem: activity dan use case diagram");

  await openEvidencePath("/medical-assets");
  await clickButton("Tambah Inventaris");
  await expectVisibleText("Tambah Inventaris Medis Baru");
  await clickButton("Batal");
  checked.push("Inventaris Medis: buka/tutup formulir");

  await openEvidencePath("/non-medical-assets");
  await clickButton("Tambah Inventaris");
  await expectVisibleText("Tambah Inventaris Non-Medis Baru");
  await clickButton("Batal");
  checked.push("Inventaris Non-Medis: buka/tutup formulir");

  await openEvidencePath("/reports");
  for (const label of ["Aset", "Pemeliharaan", "Peminjaman", "Penggunaan", "Ringkasan"]) await clickTab(label);
  checked.push("Laporan & Analitik: seluruh tab analitik");

  await openEvidencePath("/users");
  await clickButton("Hak Akses Role");
  await expectVisibleText("Menu yang Diizinkan");
  await clickButton("Data Pengguna");
  checked.push("Manajemen Pengguna: data dan hak akses");

  await openEvidencePath("/sanctions");
  for (const label of ["Selesai", "Semua", "Aktif"]) await clickTab(label);
  checked.push("Manajemen Sanksi: seluruh tab status");

  await openEvidencePath("/maintenance");
  await expectVisibleText("Kalender Pemeliharaan");
  await clickButton("Tambah Pemeliharaan");
  await expectVisibleText("Tambah Pemeliharaan Sarana");
  await clickVisibleByXpath('//*[@aria-label="Tutup formulir"]', "Tutup formulir pemeliharaan");
  await clickTab("Riwayat Pemeliharaan Sarana");
  await clickTab("Daftar Pemeliharaan Sarana");
  checked.push("Pemeliharaan Sarana: kalender, formulir, dan perpindahan tab");

  await openEvidencePath("/borrowing");
  await clickButton("Tambah Peminjaman");
  await expectVisibleText("Simpan Peminjaman");
  await clickButton("Batal");
  checked.push("Peminjaman: buka/tutup formulir");

  await openEvidencePath("/settings");
  for (const text of ["Profil Akun", "Ganti Sandi", "Informasi Sistem"]) await expectVisibleText(text);
  checked.push("Pengaturan: profil, sandi, dan informasi sistem");

  await openEvidencePath("/returns");
  await clickTab("Riwayat Pengembalian");
  await clickTab("Alat yang Perlu Dikembalikan");
  checked.push("Pengembalian: perpindahan tab");

  await openEvidencePath("/asset-usage");
  await clickButton("Tambah Penggunaan");
  await expectVisibleText("Jenis Pemakaian");
  await clickVisibleByXpath('//*[@aria-label="Tutup formulir penggunaan"]', "Tutup formulir penggunaan");
  checked.push("Penggunaan: buka/tutup formulir");

  await openEvidencePath("/disposal");
  for (const label of ["Disetujui", "Ditolak", "Semua", "Menunggu"]) await clickTab(label);
  checked.push("Penghapusan Aset: seluruh tab status");

  await openEvidencePath("/dss");
  for (const label of ["Ranking Prioritas", "Riwayat Perhitungan", "Bobot Kriteria"]) await clickTab(label);
  checked.push("SPK Prioritas Aset: bobot, ranking, dan riwayat");

  await openEvidencePath("/unggahan");
  assert.ok((await driver.findElements(By.css('input[type="file"]'))).length > 0, "Kontrol unggah file tidak ditemukan");
  checked.push("Unggah Dokumen: kontrol pemilihan file");

  return `${checked.length} kelompok fitur diverifikasi lewat kontrol UI.\n${checked.join("\n")}`;
});

scenario(21, "Logout dari sistem", "/login", async () => {
  await cleanupCreatedData();

  await driver.executeScript(() => document.getElementById("selenium-evidence")?.remove());
  await driver.get(baseUrl);
  const logoutButton = await driver.wait(
    until.elementLocated(By.xpath('//button[contains(normalize-space(), "Keluar") or contains(normalize-space(), "Logout")]')),
    timeout,
  );
  await driver.wait(until.elementIsVisible(logoutButton), timeout);
  await logoutButton.click();
  await waitForPath(driver, "/login");
  const token = await driver.executeScript(
    "return localStorage.getItem('token') || sessionStorage.getItem('token')",
  );
  assert.equal(token, null);
  return "Sesi berakhir, token terhapus, dan halaman login ditampilkan.";
});
