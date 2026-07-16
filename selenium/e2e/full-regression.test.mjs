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
  scheduleId: 0,
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

  if (state.assetId && state.scheduleId) {
    try {
      const maintenance = await api(
        "GET",
        `/maintenance?assetId=${state.assetId}&assetType=medical&limit=100`,
        token,
      );
      for (const item of extractRows(maintenance)) {
        if (Number(item.scheduleId ?? item.schedule_id) === state.scheduleId) {
          await safeApi("DELETE", `/maintenance/${item.id}`, {
            deleteReason: "Pembersihan data Selenium",
          });
        }
      }
    } catch {
      // Lanjutkan cleanup entitas lain.
    }
  }

  for (const id of [...state.borrowingIds].reverse()) {
    await safeApi("DELETE", `/borrowing/${id}`);
  }
  state.borrowingIds = [];

  if (state.scheduleId) {
    await safeApi("DELETE", `/maintenance-schedule/${state.scheduleId}`);
    state.scheduleId = 0;
  }

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
        "inset:24px",
        "z-index:2147483647",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "background:rgba(15,23,42,.82)",
        "font-family:Arial,sans-serif",
      ].join(";");
      const card = document.createElement("div");
      card.style.cssText = [
        "width:min(760px,90vw)",
        "padding:36px",
        "border-radius:20px",
        "background:white",
        `border:6px solid ${passedArg ? "#16a34a" : "#dc2626"}`,
        "box-shadow:0 24px 80px rgba(0,0,0,.35)",
        "color:#0f172a",
      ].join(";");
      const status = document.createElement("div");
      status.style.cssText = `font-size:18px;font-weight:700;color:${passedArg ? "#15803d" : "#b91c1c"}`;
      status.textContent = passedArg ? "LULUS" : "GAGAL";
      const heading = document.createElement("h1");
      heading.style.cssText = "font-size:30px;margin:10px 0 18px";
      heading.textContent = titleArg;
      const detail = document.createElement("pre");
      detail.style.cssText = "white-space:pre-wrap;font-size:16px;line-height:1.55;background:#f1f5f9;padding:18px;border-radius:12px";
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

async function openEvidencePath(pathname) {
  if (!pathname) return;

  try {
    await driver.get(`${baseUrl}${pathname}`);
    await driver.wait(until.elementLocated(By.css("body")), timeout);
    await driver.wait(async () => {
      const readyState = await driver.executeScript("return document.readyState");
      return readyState === "interactive" || readyState === "complete";
    }, timeout);
  } catch {
    // Abaikan kegagalan navigasi agar verifikasi utama tetap berjalan.
  }
}

function scenario(number, title, evidencePath, callback) {
  const screenshotName = `${String(number).padStart(2, "0")}-${title}`;
  test(title, async () => {
    try {
      const detail = await callback();
      await openEvidencePath(evidencePath);
      await showEvidence(title, detail || "Skenario berhasil diverifikasi.", true);
      await saveScreenshot(driver, screenshotName, "pass");
    } catch (error) {
      await openEvidencePath(evidencePath);
      try {
        await showEvidence(title, error instanceof Error ? error.message : String(error), false);
        await saveScreenshot(driver, screenshotName, "fail");
      } catch {
        // Pertahankan error skenario asli bila browser sudah tidak dapat mengambil screenshot.
      }
      throw error;
    }
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
  await driver.findElement(By.id("nip")).sendKeys(adminUsername);
  await driver.findElement(By.id("password")).sendKeys(adminPassword);
  await driver.findElement(By.xpath('//button[normalize-space()="Masuk"]')).click();
  await waitForPath(driver, "/");

  const session = await driver.executeScript(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const rawUser = localStorage.getItem("user") || localStorage.getItem("hospital_current_user") || sessionStorage.getItem("user");
    return { token, user: rawUser ? JSON.parse(rawUser) : null };
  });
  assert.ok(session.token);
  assert.equal(session.user?.role, "admin", "Akun pengujian harus memiliki role admin");
  state.admin = session;
  return `NIP: ${adminUsername}\nRole: ${session.user.role}\nDashboard berhasil dibuka.`;
});

scenario(2, "Password salah", "/login", async () => {
  const response = await api("POST", "/auth/login", null, {
    nip: adminUsername,
    password: `${adminPassword}-salah`,
  });
  assertStatus(response, 401);
  assert.equal(response.body.success, false);
  return `HTTP ${response.status}\n${response.body.message}`;
});

scenario(3, "Field kosong", "/login", async () => {
  const response = await api("POST", "/auth/login", null, { nip: "", password: "" });
  assertStatus(response, 400);
  assert.equal(response.body.success, false);
  return `HTTP ${response.status}\nField login kosong ditolak.`;
});

scenario(4, "Tambah user baru valid", "/users", async () => {
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

scenario(16, "Buat jadwal pemeliharaan", "/maintenance-schedule", async () => {
  const tanggal = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
  const response = await api("POST", "/maintenance-schedule", state.admin.token, {
    assetId: state.assetId,
    assetType: "medical",
    tanggal,
    deskripsi: "Jadwal Selenium",
    status: "terjadwal",
  });
  assertStatus(response, 201);
  assert.equal(response.body.success, true);
  state.scheduleId = Number(response.body.data.id);
  return `Jadwal ID ${state.scheduleId}\nTanggal: ${tanggal}`;
});

scenario(17, "Update status pemeliharaan", "/maintenance", async () => {
  const response = await api("PATCH", `/maintenance-schedule/${state.scheduleId}/status`, state.admin.token, {
    status: "proses",
  });
  assertStatus(response, 200);
  assert.equal(response.body.data.status, "proses");
  return `Jadwal ID ${state.scheduleId}\nStatus: proses`;
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

scenario(20, "Logout dari sistem", "/login", async () => {
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
