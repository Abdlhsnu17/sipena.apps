import assert from "node:assert/strict";
import { By, Key } from "selenium-webdriver";
import { timeout } from "./browser.mjs";

/**
 * Skenario penguncian status aset antar modul (peminjaman, penggunaan,
 * pemeliharaan, dan penghapusan). Dipakai bersama oleh suite regresi penuh dan
 * suite smoke agar keduanya memverifikasi aturan bisnis yang sama tanpa
 * menduplikasi kode.
 *
 * Modul ini mandiri: ia membuat akun peminjam dan seluruh aset ujinya sendiri,
 * lalu membersihkannya lewat `cleanup()`.
 */

const noop = async () => {};
const retryableStatusCodes = new Set([429]);

export function createAssetStatusScenarios({
  getDriver,
  runId,
  openFeaturePath,
  pauseStep = noop,
}) {
  // Penggunaan alat hanya boleh dicatat oleh akun pada sub ruangan yang sama,
  // sehingga aset uji penggunaan dibuat dengan lokasi yang identik.
  const usageRoom = `Ruang Selenium ${runId}`;
  const testClientIp = `198.51.100.${Number(String(runId).replace(/\D/g, "").slice(-2) || "1") % 254 || 1}`;
  // Kolom `users.nip` hanya menampung 20 karakter, jadi identitas akun uji
  // diringkas dari runId (bagian acaknya ikut terbawa agar tetap unik).
  const compactRunId = String(runId).replace(/\D/g, "").slice(-12);
  const borrower = {
    nip: `E2EL${compactRunId}`,
    password: "E2eUserTest123",
    email: `selenium-lock-${runId}@example.invalid`,
    phoneNumber: `08${compactRunId}`,
    workUnit: "Instalasi Selenium",
    subWorkUnit: usageRoom,
  };
  const assetTemplate = {
    assetCode: `SEL-LOCK-${runId}`,
    category: "Peralatan Uji",
    type: "medical",
    status: "available",
    condition: "good",
  };

  const state = {
    admin: null,
    borrower: null,
    assetIds: [],
    borrowingIds: [],
    maintenanceId: 0,
    maintenanceAssetId: 0,
    usageAssetId: 0,
    usageLogId: 0,
    disposedAssetId: 0,
    disposalRequestId: 0,
  };

  async function api(method, endpoint, token, body) {
    return getDriver().executeAsyncScript(
      function request(methodArg, endpointArg, tokenArg, bodyArg, done) {
        const headers = {};
        if (bodyArg !== null) headers["Content-Type"] = "application/json";
        if (tokenArg) headers.Authorization = `Bearer ${tokenArg}`;
        headers["X-Forwarded-For"] = testClientIp;
        headers["X-Real-IP"] = testClientIp;

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

  async function apiWithRetry(method, endpoint, token, body, {
    retries = 4,
    baseDelayMs = 500,
  } = {}) {
    let lastResponse = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      lastResponse = await api(method, endpoint, token, body);
      if (!retryableStatusCodes.has(lastResponse.status) || attempt === retries) {
        return lastResponse;
      }

      const delayMs = baseDelayMs * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return lastResponse;
  }

  function assertStatus(response, expected) {
    assert.equal(
      response.status,
      expected,
      `Status ${response.status}, respons: ${JSON.stringify(response.body)}`,
    );
  }

  function assertRejected(response, pattern, description) {
    assert.equal(
      response.body?.success,
      false,
      `${description} seharusnya ditolak, respons: ${JSON.stringify(response.body)}`,
    );
    assert.match(String(response.body?.message || ""), pattern);
  }

  async function createAsset(suffix, name, overrides = {}) {
    const response = await api("POST", "/assets", state.admin.token, {
      ...assetTemplate,
      assetCode: `${assetTemplate.assetCode}-${suffix}`,
      name,
      ...overrides,
    });
    assertStatus(response, 201);
    assert.equal(response.body.success, true, `Aset uji ${suffix} gagal dibuat`);
    const assetId = Number(response.body.data.id);
    state.assetIds.push(assetId);
    return assetId;
  }

  async function readAssetStatus(assetId) {
    const response = await api("GET", `/assets/${assetId}?type=medical`, state.admin.token);
    assertStatus(response, 200);
    return String(response.body.data.status || "");
  }

  async function requestBorrowing(assetId, purpose) {
    return api("POST", "/borrowing", state.borrower.token, {
      assetId,
      assetType: "medical",
      borrowDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      purpose,
      quantity: 1,
    });
  }

  async function readBorrowingInventoryOptions() {
    return getDriver().executeScript(
      "return Array.from(document.querySelectorAll('[cmdk-item]')).map((item) => item.innerText.replace(/\\s+/g, ' ').trim())",
    );
  }

  async function clickVisibleByXpath(xpath, description) {
    const driver = getDriver();
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
    await element.click();
    await pauseStep();
    return element;
  }

  /**
   * Membuka formulir peminjaman lalu memfilter pemilih inventaris dengan kata
   * kunci. Daftar yang tampil di sinilah "daftar transaksi" yang dipakai
   * pengguna untuk memilih alat yang boleh dipinjam.
   */
  async function searchBorrowingInventory(keyword) {
    const driver = getDriver();
    await openFeaturePath("/borrowing");
    await clickVisibleByXpath(
      '//button[normalize-space(.)="Tambah Peminjaman"]',
      'Tombol "Tambah Peminjaman"',
    );
    await clickVisibleByXpath(
      '//button[@aria-label="Pilih satu atau lebih inventaris"]',
      "Pemilih inventaris peminjaman",
    );

    const searchInput = await driver.wait(async () => {
      const candidates = await driver.findElements(By.css("[cmdk-input]"));
      for (const candidate of candidates) {
        if (await candidate.isDisplayed()) return candidate;
      }
      return null;
    }, timeout, "Kolom pencarian inventaris peminjaman tidak ditemukan");

    await searchInput.clear();
    await searchInput.sendKeys(keyword);
    await pauseStep();
  }

  /**
   * Menutup popover pemilih dan dialog peminjaman. Wajib dipanggil setelah
   * pemeriksaan daftar: overlay dialog yang tertinggal terbuka membuat klik
   * berikutnya (mis. tombol Keluar) terhalang `ElementClickInterceptedError`.
   */
  async function closeBorrowingForm() {
    const driver = getDriver();
    try {
      const body = await driver.findElement(By.css("body"));
      await body.sendKeys(Key.ESCAPE);
      await pauseStep();
      await body.sendKeys(Key.ESCAPE);
      await pauseStep();
    } catch {
      // Halaman mungkin sudah berpindah; pembersihan bersifat best-effort.
    }
  }

  async function expectBorrowingInventoryOption(assetName) {
    await getDriver().wait(async () => {
      const options = await readBorrowingInventoryOptions();
      return options.some((option) => option.includes(assetName));
    }, timeout, `Inventaris "${assetName}" tidak muncul pada daftar peminjaman`);
  }

  async function expectBorrowingInventoryEmpty(assetName) {
    const driver = getDriver();
    await driver.wait(async () => {
      const options = await readBorrowingInventoryOptions();
      if (options.some((option) => option.includes(assetName))) return false;
      const bodyText = await driver.findElement(By.css("body")).getText();
      return options.length === 0
        && bodyText.replace(/\s+/g, " ").includes("Tidak ada alat inventaris yang tersedia");
    }, timeout, `Inventaris "${assetName}" masih muncul pada daftar peminjaman`);
  }

  /**
   * Menyiapkan sesi admin (dibaca dari browser yang sudah login) dan akun
   * peminjam khusus skenario ini.
   */
  async function setup() {
    const session = await getDriver().executeScript(() => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const rawUser = localStorage.getItem("user")
        || localStorage.getItem("hospital_current_user")
        || sessionStorage.getItem("user");
      return { token, user: rawUser ? JSON.parse(rawUser) : null };
    });
    assert.ok(session.token, "Sesi admin tidak ditemukan; skenario ini harus dijalankan setelah login");
    assert.equal(session.user?.role, "admin", "Akun pengujian harus memiliki role admin");
    state.admin = session;

    const created = await apiWithRetry("POST", "/users", state.admin.token, {
      ...borrower,
      name: "Peminjam Uji Status Selenium",
      role: "user",
      staffAccessType: "all",
      gender: "Laki-laki",
      accountStatus: "active",
      mustChangePassword: false,
    });
    assertStatus(created, 201);
    assert.equal(created.body.success, true);

    const loggedIn = await apiWithRetry("POST", "/auth/login", null, {
      nip: borrower.nip,
      password: borrower.password,
    });
    assertStatus(loggedIn, 200);
    state.borrower = loggedIn.body.data;

    return `Akun peminjam ${borrower.nip} siap.\nSub ruangan: ${usageRoom}`;
  }

  // Setup hanya dijalankan sekali. Bila gagal, error aslinya diulang pada setiap
  // skenario berikutnya supaya penyebabnya jelas dan tidak berubah menjadi
  // TypeError "reading 'token'" yang menyesatkan.
  let setupPromise = null;
  function ensureReady() {
    if (!setupPromise) {
      setupPromise = setup().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Penyiapan skenario status aset gagal: ${message}`);
      });
    }
    return setupPromise;
  }

  async function cleanup() {
    const token = state.admin?.token;
    if (!token) return;

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

    if (state.usageLogId) {
      await safeApi("DELETE", `/asset-usage/${state.usageLogId}`, {
        deleteReason: "Pembersihan data Selenium",
      });
      state.usageLogId = 0;
    }

    // Permintaan penghapusan yang sudah disetujui tidak dapat dibatalkan lewat
    // API, sehingga penghapusannya bersifat best-effort seperti data uji lain.
    if (state.disposalRequestId) {
      await safeApi("DELETE", `/asset-disposal/${state.disposalRequestId}`);
      state.disposalRequestId = 0;
    }

    for (const id of [...state.borrowingIds].reverse()) {
      await safeApi("DELETE", `/borrowing/${id}`);
    }
    state.borrowingIds = [];

    if (state.borrower?.user?.id) {
      await safeApi("DELETE", `/users/${state.borrower.user.id}`, {
        deleteReason: "Pembersihan data Selenium",
      });
      state.borrower = null;
    }

    for (const id of [...state.assetIds].reverse()) {
      await safeApi("DELETE", `/assets/${id}?type=medical`);
    }
    state.assetIds = [];
  }

  const scenarios = [
    {
      key: "aset-dipinjam-ditolak-dijadwalkan-pemeliharaan",
      title: "Aset dipinjam ditolak dijadwalkan pemeliharaan",
      evidencePath: "/maintenance",
      run: async () => {
        await ensureReady();
        const assetId = await createAsset("BORROWLOCK", `Aset Dipinjam Selenium ${runId}`);
        const created = await requestBorrowing(assetId, "Uji kunci pemeliharaan Selenium");
        assertStatus(created, 201);
        const borrowingId = Number(created.body.data.id);
        state.borrowingIds.push(borrowingId);
        assertStatus(await api("PATCH", `/borrowing/${borrowingId}/approve`, state.admin.token), 200);
        assert.equal(await readAssetStatus(assetId), "borrowed");

        const response = await api("POST", "/maintenance", state.admin.token, {
          assetId,
          assetType: "medical",
          type: "preventive",
          priority: "normal",
          scheduledDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          description: "Pemeliharaan pada aset yang masih dipinjam",
        });
        // Menyetujui peminjaman ikut membuat log penggunaan aktif
        // (`ensureUsageLogForBorrowing`), dan penjagaan penggunaan diperiksa
        // lebih dulu daripada penjagaan peminjaman. Kedua pesan sama-sama sah:
        // yang wajib adalah pengajuannya ditolak.
        assertRejected(
          response,
          /peminjaman aktif|sedang digunakan/i,
          "Pengajuan pemeliharaan aset dipinjam",
        );
        return `Aset ID ${assetId} berstatus borrowed.\nHTTP ${response.status}\n${response.body.message}`;
      },
    },
    {
      key: "aset-dalam-pemeliharaan-ditolak-dipinjam",
      title: "Aset dalam pemeliharaan ditolak dipinjam",
      evidencePath: "/borrowing",
      run: async () => {
        await ensureReady();
        state.maintenanceAssetId = await createAsset(
          "MAINTLOCK",
          `Aset Pemeliharaan Selenium ${runId}`,
        );
        const maintenance = await api("POST", "/maintenance", state.admin.token, {
          assetId: state.maintenanceAssetId,
          assetType: "medical",
          type: "preventive",
          priority: "normal",
          scheduledDate: new Date(Date.now() + 86_400_000).toISOString(),
          description: "Pemeliharaan aktif untuk uji penguncian peminjaman",
        });
        assertStatus(maintenance, 201);
        assert.equal(maintenance.body.success, true, `Pemeliharaan gagal dibuat: ${maintenance.body.message}`);
        state.maintenanceId = Number(maintenance.body.data.id);

        const scheduled = await api("PUT", `/maintenance/${state.maintenanceId}`, state.admin.token, {
          status: "scheduled",
          scheduledDate: new Date(Date.now() + 86_400_000).toISOString(),
        });
        assertStatus(scheduled, 200);
        assert.equal(scheduled.body.data.status, "scheduled");
        assert.equal(await readAssetStatus(state.maintenanceAssetId), "maintenance");

        const response = await requestBorrowing(
          state.maintenanceAssetId,
          "Uji peminjaman saat pemeliharaan",
        );
        assertStatus(response, 400);
        assertRejected(response, /pemeliharaan aktif/i, "Peminjaman aset dalam pemeliharaan");
        return `Aset ID ${state.maintenanceAssetId} berstatus maintenance.\nHTTP ${response.status}\n${response.body.message}`;
      },
    },
    {
      key: "aset-sedang-digunakan-ditolak-dipinjam",
      title: "Aset sedang digunakan ditolak dipinjam",
      evidencePath: "/borrowing",
      run: async () => {
        await ensureReady();
        state.usageAssetId = await createAsset("INUSE", `Aset Digunakan Selenium ${runId}`, {
          location: usageRoom,
        });
        const usage = await api("POST", "/asset-usage", state.borrower.token, {
          assetId: state.usageAssetId,
          assetType: "medical",
          roomName: usageRoom,
          usageContext: "own_room",
          startedAt: new Date().toISOString(),
          usageCount: 1,
          notes: "Penggunaan aktif untuk uji Selenium",
        });
        assertStatus(usage, 201);
        assert.equal(usage.body.success, true, `Pencatatan penggunaan gagal: ${usage.body.message}`);
        state.usageLogId = Number(usage.body.data.id);
        // API mengembalikan string kosong, bukan null, untuk penggunaan yang
        // belum selesai.
        const endedAt = usage.body.data.endedAt ?? usage.body.data.ended_at ?? null;
        assert.ok(!endedAt, `Log penggunaan harus masih aktif, endedAt: ${JSON.stringify(endedAt)}`);

        const response = await requestBorrowing(
          state.usageAssetId,
          "Uji peminjaman saat alat digunakan",
        );
        assertStatus(response, 400);
        assertRejected(response, /sedang digunakan/i, "Peminjaman aset yang sedang digunakan");
        return `Aset ID ${state.usageAssetId} sedang digunakan (log ID ${state.usageLogId}).\nHTTP ${response.status}\n${response.body.message}`;
      },
    },
    {
      key: "aset-dihapuskan-tidak-muncul-di-daftar-transaksi",
      title: "Aset dihapuskan tidak muncul di daftar transaksi",
      evidencePath: "/borrowing",
      run: async () => {
        await ensureReady();
        const disposedAssetName = `Aset Dihapuskan Selenium ${runId}`;
        state.disposedAssetId = await createAsset("DISPOSED", disposedAssetName);

        try {
          await searchBorrowingInventory(disposedAssetName);
          await expectBorrowingInventoryOption(disposedAssetName);
        } finally {
          await closeBorrowingForm();
        }

        const requested = await api("POST", "/asset-disposal", state.admin.token, {
          assetId: state.disposedAssetId,
          assetType: "medical",
          reason: "Penghapusan aset untuk uji Selenium",
          conditionNotes: "Aset uji otomatis",
        });
        assertStatus(requested, 201);
        state.disposalRequestId = Number(requested.body.data.id);
        const approved = await api(
          "PATCH",
          `/asset-disposal/${state.disposalRequestId}/approve`,
          state.admin.token,
          { reviewNotes: "Disetujui pada pengujian Selenium" },
        );
        assertStatus(approved, 200);
        assert.equal(approved.body.data.status, "approved");
        assert.equal(await readAssetStatus(state.disposedAssetId), "disposed");

        try {
          await searchBorrowingInventory(disposedAssetName);
          await expectBorrowingInventoryEmpty(disposedAssetName);
        } finally {
          await closeBorrowingForm();
        }

        const response = await requestBorrowing(
          state.disposedAssetId,
          "Uji peminjaman aset dihapuskan",
        );
        assertStatus(response, 400);
        assertRejected(response, /not available/i, "Peminjaman aset yang sudah dihapuskan");
        return `Aset ID ${state.disposedAssetId} berstatus disposed.\nAset hilang dari daftar pilihan peminjaman.\nHTTP ${response.status}\n${response.body.message}`;
      },
    },
    {
      key: "aset-tersedia-kembali-setelah-pemeliharaan-divalidasi",
      title: "Aset tersedia kembali setelah pemeliharaan divalidasi",
      evidencePath: "/maintenance",
      run: async () => {
        await ensureReady();
        assert.ok(
          state.maintenanceId > 0 && state.maintenanceAssetId > 0,
          "Pemeliharaan aktif dari skenario sebelumnya tidak tersedia",
        );
        const technicianUserId = Number(state.admin.user?.id);
        assert.ok(technicianUserId > 0, "ID akun admin tidak tersedia untuk penugasan teknisi");

        const started = await api("PUT", `/maintenance/${state.maintenanceId}`, state.admin.token, {
          status: "in_progress",
          technicianUserId,
        });
        assertStatus(started, 200);
        assert.equal(started.body.data.status, "in_progress");

        const completed = await api("PUT", `/maintenance/${state.maintenanceId}`, state.admin.token, {
          status: "completed",
          checklist: "Pemeriksaan fungsi, kebersihan, dan kelistrikan selesai",
          notes: "Perbaikan selesai pada pengujian Selenium",
        });
        assertStatus(completed, 200);
        assert.equal(completed.body.data.status, "completed");

        const validated = await api("PUT", `/maintenance/${state.maintenanceId}`, state.admin.token, {
          status: "validated",
          finalCondition: "Baik dan siap digunakan",
          verificationNotes: "Validasi akhir pengujian Selenium",
        });
        assertStatus(validated, 200);
        assert.equal(validated.body.data.status, "validated");
        assert.equal(await readAssetStatus(state.maintenanceAssetId), "available");

        const borrowed = await requestBorrowing(
          state.maintenanceAssetId,
          "Peminjaman setelah pemeliharaan divalidasi",
        );
        assertStatus(borrowed, 201);
        assert.equal(borrowed.body.success, true);
        state.borrowingIds.push(Number(borrowed.body.data.id));
        return `Pemeliharaan ID ${state.maintenanceId} berstatus validated.\nAset ID ${state.maintenanceAssetId} kembali available dan dipinjam pada ID ${borrowed.body.data.id}.`;
      },
    },
  ];

  return { setup: ensureReady, cleanup, scenarios, usageRoom };
}
