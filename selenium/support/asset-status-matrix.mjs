import assert from "node:assert/strict";
import { By, Key, until } from "selenium-webdriver";
import { createDriver, openPath, timeout, waitForPath } from "./browser.mjs";

/**
 * Matriks aturan status aset terhadap tiga aksi transaksi.
 *
 *   Status aset        | Peminjaman baru | Penggunaan antarunit | Pemeliharaan
 *   -------------------+-----------------+----------------------+-------------
 *   Tersedia           | Diizinkan       | Diizinkan            | Diizinkan
 *   Sedang digunakan   | Ditolak         | Ditolak              | Ditolak
 *   Dipinjam           | Ditolak         | Ditolak              | Ditolak
 *   Rusak              | Ditolak         | Ditolak              | Diizinkan
 *   Dalam pemeliharaan | Ditolak         | Ditolak              | —
 *
 * Modul ini mandiri: ia membuat akun peminjam dan seluruh aset ujinya sendiri,
 * membawa setiap aset ke status yang diuji, lalu membersihkannya lewat
 * `cleanup()`.
 *
 * Catatan penting soal baris "Rusak".
 * ----------------------------------
 * Penolakan aset berkondisi rusak hanya ditegakkan di lapisan antarmuka:
 *
 *   - `apps/frontend/src/app/borrowing/page.tsx` (`borrowableAssets`)
 *   - `apps/frontend/src/app/asset-usage/page.tsx` (`selectableAssets`)
 *
 * Di sisi API, `borrowing.service.ts` hanya memeriksa `condition` untuk detail
 * item spesifik, sedangkan peminjaman pada aset master hanya memeriksa
 * `status`; `asset-usage.service.ts` tidak memeriksa `condition` sama sekali.
 * Karena itu dua sel tersebut diverifikasi lewat daftar pilihan pada formulir,
 * bukan lewat respons API. Agar daftar kosong tidak lolos sebagai "berhasil",
 * setiap pemeriksaan memakai aset kontrol yang wajib tetap muncul.
 *
 * Catatan soal "Penggunaan antarunit".
 * -----------------------------------
 * Konteks pemakaian antarunit adalah `cross_room` ("Antar instalasi").
 * `validateUsageSubRoomAccess` tetap mensyaratkan lokasi aset memuat sub
 * ruangan akun untuk konteks apa pun, sehingga seluruh aset uji ditempatkan
 * pada sub ruangan akun peminjam.
 */

const noop = async () => {};
const retryableStatusCodes = new Set([429]);

export const COLUMN_LABELS = {
  borrowing: "Peminjaman baru",
  usage: "Penggunaan antarunit",
  maintenance: "Pemeliharaan",
};

export function createAssetStatusMatrix({ getDriver, runId, pauseStep = noop }) {
  const usageRoom = `Ruang Selenium ${runId}`;
  const testClientIp = `198.51.100.${Number(String(runId).replace(/\D/g, "").slice(-2) || "1") % 254 || 1}`;
  // Kolom `users.nip` hanya menampung 20 karakter, jadi identitas akun uji
  // diringkas dari runId (bagian acaknya ikut terbawa agar tetap unik).
  const compactRunId = String(runId).replace(/\D/g, "").slice(-12);
  const borrower = {
    nip: `E2EM${compactRunId}`,
    password: "E2eUserTest123",
    email: `selenium-matrix-${runId}@example.invalid`,
    phoneNumber: `08${compactRunId}`,
    workUnit: "Instalasi Selenium",
    subWorkUnit: usageRoom,
  };
  const assetTemplate = {
    assetCode: `SEL-MTX-${runId}`,
    category: "Peralatan Uji",
    type: "medical",
    status: "available",
    condition: "good",
    location: usageRoom,
  };

  // Kata kunci pencarian pada pemilih inventaris. Semua aset uji memuat penanda
  // ini pada namanya sehingga satu pencarian menampilkan aset kontrol dan aset
  // rusak sekaligus.
  const searchKeyword = `Matriks ${runId}`;
  const assetName = (label) => `Aset ${label} ${searchKeyword}`;

  const names = {
    availableBorrowing: assetName("Tersedia Pinjam"),
    availableUsage: assetName("Tersedia Pakai"),
    availableMaintenance: assetName("Tersedia Pelihara"),
    control: assetName("Kontrol"),
    inUse: assetName("Sedang Digunakan"),
    borrowed: assetName("Dipinjam"),
    damaged: assetName("Rusak"),
    maintenance: assetName("Dalam Pemeliharaan"),
  };

  const state = {
    admin: null,
    borrower: null,
    uiDriver: null,
    assets: {},
    assetIds: [],
    borrowingIds: [],
    usageLogIds: [],
    maintenanceIds: [],
  };

  // Sel bertanda "—" tidak menjalankan aksi apa pun, jadi hasilnya dicatat di
  // muka agar ringkasan akhir tetap menampilkan matriks yang utuh.
  const results = [
    {
      row: "Dalam pemeliharaan",
      column: COLUMN_LABELS.maintenance,
      expectation: "—",
      detail: "Tidak berlaku; tidak diuji.",
    },
  ];

  function record(row, column, expectation, detail) {
    results.push({ row, column, expectation, detail });
  }

  async function api(method, endpoint, token, body) {
    return getDriver().executeAsyncScript(
      // Fungsi ini diserialisasi lalu dijalankan di dalam browser, sehingga
      // tidak dapat mengakses variabel dari scope Node: `testClientIp` wajib
      // dikirim sebagai argumen.
      function request(methodArg, endpointArg, tokenArg, bodyArg, clientIpArg, done) {
        const headers = {};
        if (bodyArg !== null) headers["Content-Type"] = "application/json";
        if (tokenArg) headers.Authorization = `Bearer ${tokenArg}`;
        headers["X-Forwarded-For"] = clientIpArg;
        headers["X-Real-IP"] = clientIpArg;

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
      testClientIp,
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

      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
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

  function assertAllowed(response, description) {
    assertStatus(response, 201);
    assert.equal(
      response.body?.success,
      true,
      `${description} seharusnya diizinkan, respons: ${JSON.stringify(response.body)}`,
    );
  }

  /**
   * Kontrak penolakan yang dipegang seluruh frontend adalah `body.success`,
   * karena itu bendera tersebut selalu diperiksa.
   *
   * Kode HTTP hanya ditegakkan bila endpoint-nya memang konsisten. POST
   * /api/borrowing dan POST /api/asset-usage memakai
   * `res.status(result.success ? 201 : 400)`, jadi keduanya dikunci pada 400.
   * POST /api/maintenance memakai `res.status(201)` tanpa syarat
   * (`apps/backend/src/controllers/maintenance.controller.ts:224`) sehingga
   * penolakannya tetap terkirim sebagai HTTP 201; untuk endpoint itu
   * `expectedStatus` sengaja dikosongkan agar test menguji aturan bisnisnya,
   * bukan ikut mengesahkan kode status yang keliru.
   */
  function assertRejected(response, pattern, description, { expectedStatus } = {}) {
    if (expectedStatus) {
      assertStatus(response, expectedStatus);
    } else {
      assert.ok(
        response.status > 0 && response.status < 500,
        `${description} gagal karena error server, respons: ${JSON.stringify(response.body)}`,
      );
    }

    assert.equal(
      response.body?.success,
      false,
      `${description} seharusnya ditolak, respons: ${JSON.stringify(response.body)}`,
    );
    assert.match(
      String(response.body?.message || ""),
      pattern,
      `${description} ditolak dengan alasan yang tidak dikenali`,
    );
  }

  async function createAsset(key, suffix, name, overrides = {}) {
    const response = await api("POST", "/assets", state.admin.token, {
      ...assetTemplate,
      assetCode: `${assetTemplate.assetCode}-${suffix}`,
      name,
      ...overrides,
    });
    assertStatus(response, 201);
    assert.equal(response.body.success, true, `Aset uji ${suffix} gagal dibuat`);
    const assetId = Number(response.body.data.id);
    state.assets[key] = assetId;
    state.assetIds.push(assetId);
    return assetId;
  }

  async function readAssetStatus(assetId) {
    const response = await api("GET", `/assets/${assetId}?type=medical`, state.admin.token);
    assertStatus(response, 200);
    return String(response.body.data.status || "");
  }

  // --- Tiga aksi yang diuji -------------------------------------------------

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

  async function requestUsage(assetId, notes, usageContext = "cross_room") {
    return api("POST", "/asset-usage", state.borrower.token, {
      assetId,
      assetType: "medical",
      roomName: usageRoom,
      usageContext,
      startedAt: new Date().toISOString(),
      usageCount: 1,
      notes,
    });
  }

  async function requestMaintenance(assetId, description) {
    return api("POST", "/maintenance", state.admin.token, {
      assetId,
      assetType: "medical",
      type: "corrective",
      priority: "normal",
      scheduledDate: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      description,
    });
  }

  // --- Pemeriksaan lewat antarmuka -----------------------------------------

  /**
   * Sesi terpisah untuk akun peminjam. Pemilih alat pada halaman Penggunaan
   * hanya menampilkan aset pada sub ruangan akun yang sedang login, sedangkan
   * akun admin pengujian tidak memiliki sub ruangan. Tanpa sesi ini, daftar
   * selalu kosong sehingga asersi "aset rusak tidak muncul" lolos tanpa arti.
   */
  async function ensureUiDriver() {
    if (state.uiDriver) return state.uiDriver;

    const driver = await createDriver();
    state.uiDriver = driver;

    await openPath(driver, "/login");
    const nipInput = await driver.wait(until.elementLocated(By.id("nip")), timeout);
    await driver.wait(until.elementIsVisible(nipInput), timeout);
    await nipInput.sendKeys(borrower.nip);
    await driver.findElement(By.id("password")).sendKeys(borrower.password);
    await driver.findElement(By.xpath('//button[normalize-space()="Masuk"]')).click();
    await waitForPath(driver, "/");

    return driver;
  }

  async function clickVisibleByXpath(driver, xpath, description) {
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

  async function readPickerOptions(driver) {
    return driver.executeScript(
      "return Array.from(document.querySelectorAll('[cmdk-item]')).map((item) => item.innerText.replace(/\\s+/g, ' ').trim())",
    );
  }

  /**
   * Menutup popover pemilih dan dialog formulir. Overlay yang tertinggal
   * terbuka membuat klik berikutnya terhalang `ElementClickInterceptedError`.
   */
  async function closeForm(driver) {
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

  /**
   * Membuka formulir, memfilter pemilih inventaris, lalu memastikan aset
   * kontrol muncul sementara aset yang seharusnya terkunci tidak muncul.
   */
  async function expectAssetHiddenFromPicker({
    pathname,
    openButtonText,
    pickerAriaLabel,
    hiddenName,
    controlName,
  }) {
    const driver = await ensureUiDriver();

    try {
      await openPath(driver, pathname);
      await driver.wait(until.elementLocated(By.css("body")), timeout);
      await clickVisibleByXpath(
        driver,
        `//button[normalize-space(.)="${openButtonText}"]`,
        `Tombol "${openButtonText}"`,
      );
      await clickVisibleByXpath(
        driver,
        `//button[@aria-label="${pickerAriaLabel}"]`,
        `Pemilih inventaris "${pickerAriaLabel}"`,
      );

      const searchInput = await driver.wait(async () => {
        const candidates = await driver.findElements(By.css("[cmdk-input]"));
        for (const candidate of candidates) {
          if (await candidate.isDisplayed()) return candidate;
        }
        return null;
      }, timeout, "Kolom pencarian inventaris tidak ditemukan");

      await searchInput.clear();
      await searchInput.sendKeys(searchKeyword);
      await pauseStep();

      // Aset kontrol wajib muncul lebih dulu. Tanpa pemeriksaan ini, daftar
      // yang kosong karena sebab lain (filter sub ruangan, data belum termuat)
      // akan terbaca sebagai aturan yang bekerja.
      let lastOptions = [];
      await driver.wait(async () => {
        lastOptions = await readPickerOptions(driver);
        return lastOptions.some((option) => option.includes(controlName));
      }, timeout, `Aset kontrol "${controlName}" tidak muncul pada ${pathname}; daftar tidak dapat dipercaya`);

      const blocked = lastOptions.filter((option) => option.includes(hiddenName));
      assert.equal(
        blocked.length,
        0,
        `Aset "${hiddenName}" masih dapat dipilih pada ${pathname}: ${JSON.stringify(blocked)}`,
      );

      return `Aset kontrol "${controlName}" muncul, aset "${hiddenName}" tidak dapat dipilih.\n${lastOptions.length} opsi tampil pada ${pathname}.`;
    } finally {
      await closeForm(driver);
    }
  }

  // --- Penyiapan status aset ------------------------------------------------

  async function setup() {
    const session = await getDriver().executeScript(() => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const rawUser = localStorage.getItem("user")
        || localStorage.getItem("hospital_current_user")
        || sessionStorage.getItem("user");
      return { token, user: rawUser ? JSON.parse(rawUser) : null };
    });
    assert.ok(session.token, "Sesi admin tidak ditemukan; matriks ini harus dijalankan setelah login");
    assert.equal(session.user?.role, "admin", "Akun pengujian harus memiliki role admin");
    state.admin = session;

    const created = await apiWithRetry("POST", "/users", state.admin.token, {
      ...borrower,
      name: "Peminjam Uji Matriks Selenium",
      role: "user",
      staffAccessType: "all",
      gender: "Laki-laki",
      accountStatus: "active",
      mustChangePassword: false,
    });
    assertStatus(created, 201);
    assert.equal(created.body.success, true, `Akun peminjam gagal dibuat: ${created.body.message}`);

    const loggedIn = await apiWithRetry("POST", "/auth/login", null, {
      nip: borrower.nip,
      password: borrower.password,
    });
    assertStatus(loggedIn, 200);
    state.borrower = loggedIn.body.data;

    // Baris "Tersedia" memakai aset terpisah per kolom karena aksi yang
    // diizinkan mengubah status asetnya.
    await createAsset("availableBorrowing", "AVL-PINJAM", names.availableBorrowing);
    await createAsset("availableUsage", "AVL-PAKAI", names.availableUsage);
    await createAsset("availableMaintenance", "AVL-PELIHARA", names.availableMaintenance);
    // Aset kontrol tidak pernah disentuh aksi apa pun; dipakai sebagai pembanding
    // pada pemeriksaan daftar pilihan.
    await createAsset("control", "KONTROL", names.control);

    const inUseId = await createAsset("inUse", "DIGUNAKAN", names.inUse);
    const usage = await requestUsage(inUseId, "Penggunaan aktif untuk matriks status", "own_room");
    assertAllowed(usage, "Penyiapan penggunaan aktif");
    state.usageLogIds.push(Number(usage.body.data.id));

    const borrowedId = await createAsset("borrowed", "DIPINJAM", names.borrowed);
    const borrowing = await requestBorrowing(borrowedId, "Peminjaman aktif untuk matriks status");
    assertAllowed(borrowing, "Penyiapan peminjaman aktif");
    const borrowingId = Number(borrowing.body.data.id);
    state.borrowingIds.push(borrowingId);
    assertStatus(await api("PATCH", `/borrowing/${borrowingId}/approve`, state.admin.token), 200);
    assert.equal(
      await readAssetStatus(borrowedId),
      "borrowed",
      "Aset penyiapan tidak berstatus borrowed setelah peminjaman disetujui",
    );

    await createAsset("damaged", "RUSAK", names.damaged, { condition: "damaged" });

    const maintenanceId = await createAsset("maintenance", "PELIHARA", names.maintenance);
    const maintenance = await requestMaintenance(
      maintenanceId,
      "Pemeliharaan aktif untuk matriks status",
    );
    assertAllowed(maintenance, "Penyiapan pemeliharaan aktif");
    const maintenanceRecordId = Number(maintenance.body.data.id);
    state.maintenanceIds.push(maintenanceRecordId);
    const scheduled = await api("PUT", `/maintenance/${maintenanceRecordId}`, state.admin.token, {
      status: "scheduled",
      scheduledDate: new Date(Date.now() + 86_400_000).toISOString(),
    });
    assertStatus(scheduled, 200);
    assert.equal(
      await readAssetStatus(maintenanceId),
      "maintenance",
      "Aset penyiapan tidak berstatus maintenance setelah pemeliharaan dijadwalkan",
    );

    return `Akun peminjam ${borrower.nip} siap pada sub ruangan ${usageRoom}.\n${state.assetIds.length} aset uji dibuat.`;
  }

  // Setup hanya dijalankan sekali. Bila gagal, error aslinya diulang pada setiap
  // sel berikutnya supaya penyebabnya tetap jelas.
  let setupPromise = null;
  function ensureReady() {
    if (!setupPromise) {
      setupPromise = setup().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Penyiapan matriks status aset gagal: ${message}`);
      });
    }
    return setupPromise;
  }

  async function cleanup() {
    if (state.uiDriver) {
      try {
        await state.uiDriver.quit();
      } catch {
        // Penutupan browser bersifat best-effort.
      }
      state.uiDriver = null;
    }

    const token = state.admin?.token;
    if (!token) return;

    const safeApi = async (method, endpoint, body = null) => {
      try {
        await api(method, endpoint, token, body);
      } catch {
        // Cleanup bersifat best-effort agar kegagalan asli tetap terlihat.
      }
    };

    for (const id of [...state.maintenanceIds].reverse()) {
      await safeApi("DELETE", `/maintenance/${id}`, { deleteReason: "Pembersihan data Selenium" });
    }
    state.maintenanceIds = [];

    for (const id of [...state.usageLogIds].reverse()) {
      await safeApi("DELETE", `/asset-usage/${id}`, { deleteReason: "Pembersihan data Selenium" });
    }
    state.usageLogIds = [];

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
    state.assets = {};
  }

  // --- Sel matriks ----------------------------------------------------------

  const cases = [
    // Baris 1: Tersedia -> semua aksi diizinkan.
    {
      key: "tersedia-peminjaman-diizinkan",
      row: "Tersedia",
      column: COLUMN_LABELS.borrowing,
      expectation: "Diizinkan",
      evidencePath: "/borrowing",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.availableBorrowing;
        assert.equal(await readAssetStatus(assetId), "available");

        const response = await requestBorrowing(assetId, "Peminjaman aset tersedia");
        assertAllowed(response, "Peminjaman aset tersedia");
        state.borrowingIds.push(Number(response.body.data.id));

        const detail = `Aset ID ${assetId} (available) diterima.\nHTTP ${response.status}, peminjaman ID ${response.body.data.id}.`;
        record("Tersedia", COLUMN_LABELS.borrowing, "Diizinkan", detail);
        return detail;
      },
    },
    {
      key: "tersedia-penggunaan-diizinkan",
      row: "Tersedia",
      column: COLUMN_LABELS.usage,
      expectation: "Diizinkan",
      evidencePath: "/asset-usage",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.availableUsage;
        assert.equal(await readAssetStatus(assetId), "available");

        const response = await requestUsage(assetId, "Penggunaan antarunit aset tersedia");
        assertAllowed(response, "Penggunaan antarunit aset tersedia");
        state.usageLogIds.push(Number(response.body.data.id));

        const detail = `Aset ID ${assetId} (available) diterima pada konteks cross_room (Antar instalasi).\nHTTP ${response.status}, log penggunaan ID ${response.body.data.id}.`;
        record("Tersedia", COLUMN_LABELS.usage, "Diizinkan", detail);
        return detail;
      },
    },
    {
      key: "tersedia-pemeliharaan-diizinkan",
      row: "Tersedia",
      column: COLUMN_LABELS.maintenance,
      expectation: "Diizinkan",
      evidencePath: "/maintenance",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.availableMaintenance;
        assert.equal(await readAssetStatus(assetId), "available");

        const response = await requestMaintenance(assetId, "Pemeliharaan aset tersedia");
        assertAllowed(response, "Pemeliharaan aset tersedia");
        state.maintenanceIds.push(Number(response.body.data.id));

        const detail = `Aset ID ${assetId} (available) diterima.\nHTTP ${response.status}, pemeliharaan ID ${response.body.data.id}.`;
        record("Tersedia", COLUMN_LABELS.maintenance, "Diizinkan", detail);
        return detail;
      },
    },

    // Baris 2: Sedang digunakan -> semua aksi ditolak.
    {
      key: "sedang-digunakan-peminjaman-ditolak",
      row: "Sedang digunakan",
      column: COLUMN_LABELS.borrowing,
      expectation: "Ditolak",
      evidencePath: "/borrowing",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.inUse;

        const response = await requestBorrowing(assetId, "Peminjaman aset yang sedang digunakan");
        assertRejected(
          response,
          /sedang digunakan/i,
          "Peminjaman aset yang sedang digunakan",
          { expectedStatus: 400 },
        );

        const detail = `Aset ID ${assetId} memiliki log penggunaan aktif.\nHTTP ${response.status}\n${response.body.message}`;
        record("Sedang digunakan", COLUMN_LABELS.borrowing, "Ditolak", detail);
        return detail;
      },
    },
    {
      key: "sedang-digunakan-penggunaan-ditolak",
      row: "Sedang digunakan",
      column: COLUMN_LABELS.usage,
      expectation: "Ditolak",
      evidencePath: "/asset-usage",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.inUse;

        const response = await requestUsage(assetId, "Penggunaan antarunit aset yang sedang digunakan");
        assertRejected(
          response,
          /penggunaan aktif/i,
          "Penggunaan antarunit aset yang sedang digunakan",
          { expectedStatus: 400 },
        );

        const detail = `Aset ID ${assetId} memiliki log penggunaan aktif.\nHTTP ${response.status}\n${response.body.message}`;
        record("Sedang digunakan", COLUMN_LABELS.usage, "Ditolak", detail);
        return detail;
      },
    },
    {
      key: "sedang-digunakan-pemeliharaan-ditolak",
      row: "Sedang digunakan",
      column: COLUMN_LABELS.maintenance,
      expectation: "Ditolak",
      evidencePath: "/maintenance",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.inUse;

        const response = await requestMaintenance(assetId, "Pemeliharaan aset yang sedang digunakan");
        assertRejected(response, /sedang digunakan/i, "Pemeliharaan aset yang sedang digunakan");

        const detail = `Aset ID ${assetId} memiliki log penggunaan aktif.\nHTTP ${response.status}\n${response.body.message}`;
        record("Sedang digunakan", COLUMN_LABELS.maintenance, "Ditolak", detail);
        return detail;
      },
    },

    // Baris 3: Dipinjam -> semua aksi ditolak.
    {
      key: "dipinjam-peminjaman-ditolak",
      row: "Dipinjam",
      column: COLUMN_LABELS.borrowing,
      expectation: "Ditolak",
      evidencePath: "/borrowing",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.borrowed;
        assert.equal(await readAssetStatus(assetId), "borrowed");

        const response = await requestBorrowing(assetId, "Peminjaman ganda aset yang dipinjam");
        // Persetujuan peminjaman ikut membuat log penggunaan aktif
        // (`ensureUsageLogForBorrowing`), dan penjagaan penggunaan diperiksa
        // lebih dulu. Kedua alasan sama-sama sah; yang wajib adalah ditolak.
        assertRejected(
          response,
          /sedang digunakan|not available|locked|borrowed/i,
          "Peminjaman aset yang sedang dipinjam",
          { expectedStatus: 400 },
        );

        const detail = `Aset ID ${assetId} berstatus borrowed.\nHTTP ${response.status}\n${response.body.message}`;
        record("Dipinjam", COLUMN_LABELS.borrowing, "Ditolak", detail);
        return detail;
      },
    },
    {
      key: "dipinjam-penggunaan-ditolak",
      row: "Dipinjam",
      column: COLUMN_LABELS.usage,
      expectation: "Ditolak",
      evidencePath: "/asset-usage",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.borrowed;

        const response = await requestUsage(assetId, "Penggunaan antarunit aset yang dipinjam");
        assertRejected(
          response,
          /proses peminjaman|penggunaan aktif/i,
          "Penggunaan antarunit aset yang sedang dipinjam",
          { expectedStatus: 400 },
        );

        const detail = `Aset ID ${assetId} berstatus borrowed.\nHTTP ${response.status}\n${response.body.message}`;
        record("Dipinjam", COLUMN_LABELS.usage, "Ditolak", detail);
        return detail;
      },
    },
    {
      key: "dipinjam-pemeliharaan-ditolak",
      row: "Dipinjam",
      column: COLUMN_LABELS.maintenance,
      expectation: "Ditolak",
      evidencePath: "/maintenance",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.borrowed;

        const response = await requestMaintenance(assetId, "Pemeliharaan aset yang dipinjam");
        assertRejected(
          response,
          /peminjaman aktif|sedang digunakan/i,
          "Pemeliharaan aset yang sedang dipinjam",
        );

        const detail = `Aset ID ${assetId} berstatus borrowed.\nHTTP ${response.status}\n${response.body.message}`;
        record("Dipinjam", COLUMN_LABELS.maintenance, "Ditolak", detail);
        return detail;
      },
    },

    // Baris 4: Rusak -> peminjaman & penggunaan ditolak, pemeliharaan diizinkan.
    {
      key: "rusak-peminjaman-ditolak",
      row: "Rusak",
      column: COLUMN_LABELS.borrowing,
      expectation: "Ditolak",
      evidencePath: "/borrowing",
      run: async () => {
        await ensureReady();

        const detail = await expectAssetHiddenFromPicker({
          pathname: "/borrowing",
          openButtonText: "Tambah Peminjaman",
          pickerAriaLabel: "Pilih satu atau lebih inventaris",
          hiddenName: names.damaged,
          controlName: names.control,
        });

        record("Rusak", COLUMN_LABELS.borrowing, "Ditolak", detail);
        return detail;
      },
    },
    {
      key: "rusak-penggunaan-ditolak",
      row: "Rusak",
      column: COLUMN_LABELS.usage,
      expectation: "Ditolak",
      evidencePath: "/asset-usage",
      run: async () => {
        await ensureReady();

        const detail = await expectAssetHiddenFromPicker({
          pathname: "/asset-usage",
          openButtonText: "Tambah Penggunaan",
          pickerAriaLabel: "Pilih alat untuk pemakaian",
          hiddenName: names.damaged,
          controlName: names.control,
        });

        record("Rusak", COLUMN_LABELS.usage, "Ditolak", detail);
        return detail;
      },
    },
    {
      key: "rusak-pemeliharaan-diizinkan",
      row: "Rusak",
      column: COLUMN_LABELS.maintenance,
      expectation: "Diizinkan",
      evidencePath: "/maintenance",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.damaged;

        const response = await requestMaintenance(assetId, "Perbaikan aset berkondisi rusak");
        assertAllowed(response, "Pemeliharaan aset berkondisi rusak");
        state.maintenanceIds.push(Number(response.body.data.id));

        const detail = `Aset ID ${assetId} berkondisi damaged.\nHTTP ${response.status}, pemeliharaan ID ${response.body.data.id}.`;
        record("Rusak", COLUMN_LABELS.maintenance, "Diizinkan", detail);
        return detail;
      },
    },

    // Baris 5: Dalam pemeliharaan -> peminjaman & penggunaan ditolak,
    // pengajuan pemeliharaan tidak berlaku.
    {
      key: "dalam-pemeliharaan-peminjaman-ditolak",
      row: "Dalam pemeliharaan",
      column: COLUMN_LABELS.borrowing,
      expectation: "Ditolak",
      evidencePath: "/borrowing",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.maintenance;
        assert.equal(await readAssetStatus(assetId), "maintenance");

        const response = await requestBorrowing(assetId, "Peminjaman aset dalam pemeliharaan");
        assertRejected(
          response,
          /pemeliharaan aktif/i,
          "Peminjaman aset yang sedang dipelihara",
          { expectedStatus: 400 },
        );

        const detail = `Aset ID ${assetId} berstatus maintenance.\nHTTP ${response.status}\n${response.body.message}`;
        record("Dalam pemeliharaan", COLUMN_LABELS.borrowing, "Ditolak", detail);
        return detail;
      },
    },
    {
      key: "dalam-pemeliharaan-penggunaan-ditolak",
      row: "Dalam pemeliharaan",
      column: COLUMN_LABELS.usage,
      expectation: "Ditolak",
      evidencePath: "/asset-usage",
      run: async () => {
        await ensureReady();
        const assetId = state.assets.maintenance;

        const response = await requestUsage(assetId, "Penggunaan antarunit aset dalam pemeliharaan");
        assertRejected(
          response,
          /proses pemeliharaan/i,
          "Penggunaan antarunit aset yang sedang dipelihara",
          { expectedStatus: 400 },
        );

        const detail = `Aset ID ${assetId} berstatus maintenance.\nHTTP ${response.status}\n${response.body.message}`;
        record("Dalam pemeliharaan", COLUMN_LABELS.usage, "Ditolak", detail);
        return detail;
      },
    },
    {
      key: "dalam-pemeliharaan-pemeliharaan-tidak-berlaku",
      row: "Dalam pemeliharaan",
      column: COLUMN_LABELS.maintenance,
      expectation: "—",
      evidencePath: "/maintenance",
      // Sel bertanda "—" pada spesifikasi: aset yang sudah dalam pemeliharaan
      // tidak punya aturan pengajuan pemeliharaan baru untuk diverifikasi, dan
      // `maintenance.service.ts` memang tidak memiliki penjagaan pemeliharaan
      // ganda. Dilewati secara eksplisit agar tidak terbaca sebagai celah uji.
      skip: 'Sel bertanda "—" pada spesifikasi: tidak ada aturan yang diuji.',
      run: async () => {
        await ensureReady();
        record(
          "Dalam pemeliharaan",
          COLUMN_LABELS.maintenance,
          "—",
          "Tidak berlaku; tidak diuji.",
        );
        return "Tidak berlaku.";
      },
    },
  ];

  /** Ringkasan hasil untuk dicetak pada akhir suite. */
  function renderSummary() {
    const rows = ["Tersedia", "Sedang digunakan", "Dipinjam", "Rusak", "Dalam pemeliharaan"];
    const columns = [COLUMN_LABELS.borrowing, COLUMN_LABELS.usage, COLUMN_LABELS.maintenance];
    const header = ["Status aset".padEnd(20), ...columns.map((column) => column.padEnd(22))].join("| ");
    const lines = [header, "-".repeat(header.length)];

    for (const row of rows) {
      const cells = columns.map((column) => {
        const result = results.find((item) => item.row === row && item.column === column);
        return (result ? result.expectation : "tidak dijalankan").padEnd(22);
      });
      lines.push([row.padEnd(20), ...cells].join("| "));
    }

    return lines.join("\n");
  }

  return {
    setup: ensureReady,
    cleanup,
    cases,
    renderSummary,
    usageRoom,
    names,
  };
}
