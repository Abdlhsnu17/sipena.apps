import { buildRouteKey } from './route-inventory';

export interface OperationMeta {
  summary: string;
  description?: string;
  /** Peran yang diwajibkan `requireRole` di level route (di luar auth level mount). */
  roles?: string[];
  parameters?: unknown[];
  requestBody?: unknown;
  /** Digabungkan di atas response default yang diturunkan dari middleware route. */
  responses?: Record<string, unknown>;
}

const jsonBody = (schema: unknown, required = true) => ({
  required,
  content: { 'application/json': { schema } },
});

const okResponse = (description: string, schema: unknown) => ({
  description,
  content: { 'application/json': { schema } },
});

/** Envelope `{ success, message, data }` yang dipakai hampir seluruh endpoint. */
const envelope = (dataSchema: unknown) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    message: { type: 'string' },
    data: dataSchema,
  },
  required: ['success', 'message'],
});

const paginatedEnvelope = (itemSchema: unknown) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    message: { type: 'string' },
    data: { type: 'array', items: itemSchema },
    pagination: { $ref: '#/components/schemas/Pagination' },
  },
  required: ['success', 'message', 'data', 'pagination'],
});

const borrowingRef = { $ref: '#/components/schemas/Borrowing' };

const PASSWORD_POLICY =
  'Minimal 8 karakter dan harus memuat huruf besar, huruf kecil, dan angka.';

/**
 * Metadata tulisan tangan per operasi.
 *
 * Endpoint yang belum ada di sini tetap muncul di spec dengan path, metode,
 * parameter path, dan kebutuhan autentikasi yang benar — hanya ringkasan dan
 * schema body/response-nya yang masih generik. `openapi.test.ts` menjaga agar
 * setiap kunci di peta ini benar-benar cocok dengan route yang terpasang,
 * sehingga entri usang tidak menumpuk diam-diam.
 */
const operationsByKey: Record<string, OperationMeta> = {
  // ---------------------------------------------------------------- Auth ---
  [buildRouteKey('POST', '/api/auth/login')]: {
    summary: 'Login dan terbitkan JWT',
    description:
      'Menerima NIP, username, atau email pada field `nip`. Dibatasi rate limiter tersendiri ' +
      '(`LOGIN_RATE_LIMIT_MAX`, default 40 per 15 menit di produksi) dan request yang berhasil tidak dihitung.',
    requestBody: jsonBody({
      type: 'object',
      properties: {
        nip: { type: 'string', description: 'NIP, username, atau email.', example: '199203102019031005' },
        password: { type: 'string', format: 'password' },
      },
      required: ['nip', 'password'],
    }),
    responses: {
      200: okResponse('Login berhasil.', { $ref: '#/components/schemas/AuthResponse' }),
      401: {
        description: 'Password salah atau akun terkunci.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      404: {
        description: 'Akun tidak ditemukan.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },

  [buildRouteKey('POST', '/api/auth/register')]: {
    summary: 'Daftarkan akun baru',
    description: 'Dibatasi `REGISTER_RATE_LIMIT_MAX` (default 20 per jam di produksi).',
    requestBody: jsonBody({
      type: 'object',
      properties: {
        nip: { type: 'string', minLength: 8, maxLength: 20 },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        phoneNumber: { type: 'string', description: 'Nomor WhatsApp/SMS, dipakai untuk pengiriman OTP.' },
        password: { type: 'string', format: 'password', description: PASSWORD_POLICY },
        confirmPassword: { type: 'string', format: 'password', description: 'Harus sama persis dengan `password`.' },
      },
      required: ['nip', 'name', 'email', 'phoneNumber', 'password', 'confirmPassword'],
    }),
    responses: {
      201: okResponse('Akun dibuat.', { $ref: '#/components/schemas/AuthResponse' }),
      409: { $ref: '#/components/responses/Conflict' },
    },
  },

  [buildRouteKey('POST', '/api/auth/reset-password/verify')]: {
    summary: 'Minta kode verifikasi reset password',
    description:
      'Mengirim OTP 6 digit lewat channel WhatsApp/SMS yang dikonfigurasi. ' +
      'Membalas 503 bila Redis wajib aktif namun tidak tersedia, atau bila seluruh channel OTP gagal.',
    requestBody: jsonBody({
      type: 'object',
      properties: { nip: { type: 'string' } },
      required: ['nip'],
    }),
    responses: {
      200: okResponse('Kode verifikasi dikirim.', envelope({ type: 'object' })),
      400: {
        description: 'NIP tidak dikenali atau permintaan ditolak.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      503: {
        description: 'Layanan OTP atau Redis belum tersedia.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },

  [buildRouteKey('POST', '/api/auth/reset-password')]: {
    summary: 'Setel ulang password dengan kode verifikasi',
    description: 'Berhasil reset akan menaikkan `sessionVersion` sehingga seluruh token lama menjadi tidak valid.',
    requestBody: jsonBody({
      type: 'object',
      properties: {
        nip: { type: 'string' },
        verificationCode: { type: 'string', minLength: 6, maxLength: 6, pattern: '^[0-9]{6}$' },
        newPassword: { type: 'string', format: 'password', description: PASSWORD_POLICY },
        confirmPassword: { type: 'string', format: 'password', description: 'Harus sama persis dengan `newPassword`.' },
      },
      required: ['nip', 'verificationCode', 'newPassword', 'confirmPassword'],
    }),
    responses: {
      200: okResponse('Password diperbarui.', envelope({ type: 'object' })),
      400: {
        description: 'Kode verifikasi salah, kedaluwarsa, atau payload ditolak.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },

  [buildRouteKey('POST', '/api/auth/logout')]: {
    summary: 'Logout dan batalkan seluruh sesi',
    description: 'Menaikkan `sessionVersion` pengguna sehingga setiap JWT yang sudah terbit langsung ditolak.',
    responses: { 200: okResponse('Logout berhasil.', envelope({ type: 'object' })) },
  },

  [buildRouteKey('GET', '/api/auth/me')]: {
    summary: 'Ambil profil pengguna yang sedang login',
    description: 'Tetap dapat diakses ketika `mustChangePassword` bernilai true.',
    responses: {
      200: okResponse('Profil pengguna.', envelope({ $ref: '#/components/schemas/User' })),
    },
  },

  [buildRouteKey('PATCH', '/api/auth/me')]: {
    summary: 'Perbarui profil pengguna yang sedang login',
    description:
      'Menerima `multipart/form-data` agar foto profil bisa ikut diunggah. ' +
      'Foto dibatasi 5 MB dengan tipe jpg, jpeg, png, atau webp.',
    requestBody: {
      required: false,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              photo: { type: 'string', format: 'binary', description: 'Foto profil, maksimal 5 MB.' },
              name: { type: 'string', minLength: 3, maxLength: 255 },
              email: { type: 'string', format: 'email' },
              nip: { type: 'string', pattern: '^[A-Za-z0-9.\\-/\\s]{3,30}$' },
              gender: { type: 'string', enum: ['Laki-laki', 'Perempuan', 'Lainnya'] },
              workUnit: { type: 'string', maxLength: 255 },
              subWorkUnit: { type: 'string', maxLength: 255 },
              homeAddress: { type: 'string', maxLength: 500 },
              phoneNumber: { type: 'string', minLength: 10, maxLength: 25 },
            },
          },
        },
      },
    },
    responses: {
      200: okResponse('Profil diperbarui.', envelope({ $ref: '#/components/schemas/User' })),
      400: {
        description: 'Validasi gagal atau file foto ditolak.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },

  // ----------------------------------------------------------- Borrowing ---
  [buildRouteKey('GET', '/api/borrowing')]: {
    summary: 'Daftar peminjaman (paginasi + filter)',
    description:
      'Hasil dipersempit otomatis mengikuti peran dan unit kerja pemanggil. ' +
      'Staf dengan `staffAccessType` tertentu hanya melihat kategori aset yang sesuai.',
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 1000, default: 10 } },
      { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/BorrowingStatus' } },
      { name: 'userId', in: 'query', schema: { type: 'integer', minimum: 1 } },
      { name: 'assetId', in: 'query', schema: { type: 'integer', minimum: 1 } },
      { name: 'assetType', in: 'query', schema: { type: 'string', enum: ['medical', 'non_medical'] } },
      { name: 'search', in: 'query', schema: { type: 'string', maxLength: 200 } },
      {
        name: 'lockedOnly',
        in: 'query',
        description: 'Bila "true", hanya menampilkan peminjaman yang sedang mengunci inventaris.',
        schema: { type: 'string', enum: ['true', 'false'] },
      },
      { name: 'source', in: 'query', schema: { type: 'string', enum: ['medis', 'non_medis'] } },
    ],
    responses: {
      200: okResponse('Daftar peminjaman.', paginatedEnvelope(borrowingRef)),
    },
  },

  [buildRouteKey('GET', '/api/borrowing/owner-candidates')]: {
    summary: 'Cari akun aktif kandidat Pemilik/PJ inventaris',
    description: 'Dipakai form peminjaman untuk menautkan Pemilik/PJ ke akun nyata berdasarkan nama atau NIP.',
    parameters: [
      { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
    ],
    responses: {
      200: okResponse('Kandidat pemilik.', envelope({ type: 'array', items: { $ref: '#/components/schemas/User' } })),
    },
  },

  [buildRouteKey('GET', '/api/borrowing/locks')]: {
    summary: 'Daftar kunci ketersediaan inventaris',
    description:
      'Mengembalikan inventaris yang sedang terkunci oleh peminjaman aktif. ' +
      'Didaftarkan sebelum `/{id}` agar "locks" tidak tertangkap sebagai id.',
    responses: {
      200: okResponse('Kunci inventaris aktif.', envelope({ type: 'array', items: { type: 'object' } })),
    },
  },

  [buildRouteKey('GET', '/api/borrowing/{id}')]: {
    summary: 'Ambil satu peminjaman',
    responses: {
      200: okResponse('Detail peminjaman.', envelope(borrowingRef)),
      404: { $ref: '#/components/responses/NotFound' },
    },
  },

  [buildRouteKey('POST', '/api/borrowing')]: {
    summary: 'Ajukan peminjaman',
    description:
      'Peminjaman dibuat dengan status `pending` dan menunggu persetujuan. ' +
      'Bila `dueDate` dikosongkan, backend menghitungnya dari `borrowDate` ditambah durasi default.',
    requestBody: jsonBody({
      type: 'object',
      properties: {
        assetId: { type: 'integer', minimum: 1 },
        assetType: { type: 'string', enum: ['medical', 'non_medical'] },
        assetDetailId: { type: 'string' },
        assetDetailName: { type: 'string' },
        assetDetailCode: { type: 'string' },
        borrowDate: { type: 'string', format: 'date-time', description: 'Wajib format ISO 8601.' },
        dueDate: {
          type: 'string',
          format: 'date-time',
          description: 'ISO 8601 dan tidak boleh lebih awal dari `borrowDate`.',
        },
        purpose: { type: 'string', description: 'Keperluan peminjaman, wajib diisi.' },
        borrowerPosition: { type: 'string' },
        borrowerWorkUnit: { type: 'string' },
        ownerUserId: { type: 'integer', minimum: 1 },
        ownerName: { type: 'string' },
        ownerNip: { type: 'string' },
        ownerPosition: { type: 'string' },
        ownerWorkUnit: { type: 'string' },
        purposeType: { type: 'string', enum: ['inside_hospital', 'outside_hospital'] },
        destinationRoom: { type: 'string' },
        loanDurationValue: { type: 'integer', minimum: 1 },
        loanDurationUnit: { type: 'string', enum: ['day', 'month', 'year'] },
        quantity: { type: 'integer', minimum: 1 },
        notes: { type: 'string' },
      },
      required: ['assetId', 'borrowDate', 'purpose'],
    }),
    responses: {
      200: okResponse('Peminjaman diajukan.', envelope(borrowingRef)),
      409: { $ref: '#/components/responses/Conflict' },
    },
  },

  [buildRouteKey('PATCH', '/api/borrowing/{id}')]: {
    summary: 'Perbarui data peminjaman',
    roles: ['admin', 'leader'],
    requestBody: jsonBody(
      {
        type: 'object',
        description: 'Seluruh field opsional; hanya yang dikirim yang diperbarui.',
        properties: {
          borrowDate: { type: 'string', format: 'date-time' },
          dueDate: { type: 'string', format: 'date-time', description: 'Tidak boleh lebih awal dari `borrowDate`.' },
          purpose: { type: 'string' },
          borrowerPosition: { type: 'string' },
          borrowerWorkUnit: { type: 'string' },
          ownerUserId: { type: 'integer', minimum: 1 },
          ownerName: { type: 'string' },
          ownerNip: { type: 'string' },
          ownerPosition: { type: 'string' },
          ownerWorkUnit: { type: 'string' },
          purposeType: { type: 'string', enum: ['inside_hospital', 'outside_hospital'] },
          destinationRoom: { type: 'string' },
          loanDurationValue: { type: 'integer', minimum: 1 },
          loanDurationUnit: { type: 'string', enum: ['day', 'month', 'year'] },
          quantity: { type: 'integer', minimum: 1 },
          notes: { type: 'string' },
          returnCondition: { type: 'string' },
          returnNotes: { type: 'string' },
        },
      },
      false,
    ),
    responses: {
      200: okResponse('Peminjaman diperbarui.', envelope(borrowingRef)),
      404: { $ref: '#/components/responses/NotFound' },
    },
  },

  [buildRouteKey('PATCH', '/api/borrowing/{id}/approve')]: {
    summary: 'Setujui peminjaman',
    roles: ['admin', 'leader', 'staff_pj'],
    responses: {
      200: okResponse('Peminjaman disetujui.', envelope(borrowingRef)),
      404: { $ref: '#/components/responses/NotFound' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },

  [buildRouteKey('PATCH', '/api/borrowing/{id}/reject')]: {
    summary: 'Tolak peminjaman',
    roles: ['admin', 'leader', 'staff_pj'],
    requestBody: jsonBody({
      type: 'object',
      properties: { reason: { type: 'string', description: 'Alasan penolakan, wajib diisi.' } },
      required: ['reason'],
    }),
    responses: {
      200: okResponse('Peminjaman ditolak.', envelope(borrowingRef)),
      404: { $ref: '#/components/responses/NotFound' },
    },
  },

  [buildRouteKey('PATCH', '/api/borrowing/{id}/return')]: {
    summary: 'Catat pengembalian aset',
    description: 'Pengembalian masih menunggu validasi petugas lewat `PATCH /api/borrowing/{id}/validate-return`.',
    roles: ['admin', 'leader', 'staff', 'staff_pj', 'user'],
    requestBody: jsonBody({
      type: 'object',
      properties: { condition: { type: 'string', description: 'Kondisi aset saat dikembalikan, wajib diisi.' } },
      required: ['condition'],
    }),
    responses: {
      200: okResponse('Pengembalian tercatat.', envelope(borrowingRef)),
      404: { $ref: '#/components/responses/NotFound' },
    },
  },

  [buildRouteKey('PATCH', '/api/borrowing/{id}/validate-return')]: {
    summary: 'Validasi pengembalian aset',
    roles: ['admin', 'leader', 'staff_pj'],
    responses: {
      200: okResponse('Pengembalian tervalidasi.', envelope(borrowingRef)),
      404: { $ref: '#/components/responses/NotFound' },
    },
  },

  [buildRouteKey('PATCH', '/api/borrowing/{id}/extend')]: {
    summary: 'Perpanjang jatuh tempo peminjaman',
    description: 'Ditolak bila peminjaman ditandai `isExtensionBlocked`.',
    requestBody: jsonBody({
      type: 'object',
      properties: {
        newDueDate: { type: 'string', format: 'date-time', description: 'Wajib format ISO 8601.' },
        extensionNotes: { type: 'string' },
      },
      required: ['newDueDate'],
    }),
    responses: {
      200: okResponse('Jatuh tempo diperpanjang.', envelope(borrowingRef)),
      404: { $ref: '#/components/responses/NotFound' },
      409: { $ref: '#/components/responses/Conflict' },
    },
  },

  [buildRouteKey('GET', '/api/borrowing/user/{userId}/blocking')]: {
    summary: 'Daftar peminjaman yang memblokir pengguna',
    description: 'Peminjaman terlambat atau bersanksi yang menghalangi pengguna mengajukan peminjaman baru.',
    responses: {
      200: okResponse('Peminjaman yang memblokir.', envelope({ type: 'array', items: borrowingRef })),
    },
  },

  [buildRouteKey('DELETE', '/api/borrowing/{id}')]: {
    summary: 'Hapus peminjaman',
    description: 'Soft delete: baris tetap tersimpan dengan `deletedAt`, `deletedBy`, dan `deleteReason`.',
    roles: ['admin'],
    responses: {
      200: okResponse('Peminjaman dihapus.', envelope({ type: 'object' })),
      404: { $ref: '#/components/responses/NotFound' },
    },
  },
};

export const getOperationMeta = (key: string): OperationMeta | undefined => operationsByKey[key];

export const documentedOperationKeys = (): string[] => Object.keys(operationsByKey);
