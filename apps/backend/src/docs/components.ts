/**
 * Schema OpenAPI yang dipakai ulang lintas endpoint.
 *
 * Bentuknya mengikuti tipe yang benar-benar dikembalikan backend (lihat
 * `src/types/auth.ts` dan `src/models/*.model.ts`), bukan bentuk ideal, agar
 * dokumentasi cocok dengan response nyata.
 */
export const schemas: Record<string, unknown> = {
  ErrorResponse: {
    type: 'object',
    description: 'Bentuk error standar dari seluruh endpoint API.',
    properties: {
      success: { type: 'boolean', enum: [false] },
      message: { type: 'string', example: 'Internal server error' },
      error: { description: 'Detail error tambahan; hanya terisi pada sebagian jalur error.' },
      requestId: { type: 'string', format: 'uuid', description: 'Sama dengan header X-Request-Id.' },
    },
    required: ['success', 'message'],
  },

  ValidationErrorResponse: {
    type: 'object',
    description: 'Dikembalikan `validateRequest` ketika rantai express-validator gagal.',
    properties: {
      success: { type: 'boolean', enum: [false] },
      message: {
        type: 'string',
        description: 'Pesan `.withMessage()` pertama, atau "Validation failed" bila validator tidak punya pesan khusus.',
        example: 'Password wajib diisi',
      },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'field' },
            msg: { type: 'string' },
            path: { type: 'string', example: 'password' },
            location: { type: 'string', enum: ['body', 'query', 'params', 'headers', 'cookies'] },
          },
        },
      },
    },
    required: ['success', 'message', 'errors'],
  },

  Pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, example: 1 },
      limit: { type: 'integer', minimum: 1, example: 10 },
      total: { type: 'integer', minimum: 0, example: 137 },
      totalPages: { type: 'integer', minimum: 0, example: 14 },
    },
    required: ['page', 'limit', 'total', 'totalPages'],
  },

  User: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 12 },
      nip: { type: 'string', example: '199203102019031005' },
      name: { type: 'string', example: 'Siti Rahmawati' },
      email: { type: 'string', format: 'email' },
      role: {
        type: 'string',
        description: 'Peran fungsional. Nilai di luar daftar ini tetap mungkin karena tipe backend menerima string bebas.',
        example: 'staff_pj',
      },
      staffAccessType: {
        type: 'string',
        nullable: true,
        enum: ['medis', 'non-medis', 'all', null],
        description: 'Membatasi kategori aset yang boleh diakses staf.',
      },
      gender: { type: 'string', enum: ['Laki-laki', 'Perempuan', 'Lainnya'] },
      workUnit: { type: 'string' },
      subWorkUnit: { type: 'string' },
      homeAddress: { type: 'string' },
      phoneNumber: { type: 'string' },
      photoPath: { type: 'string', description: 'Relatif terhadap /uploads/profiles.' },
      sessionVersion: {
        type: 'integer',
        description: 'Dinaikkan saat logout/reset password; token dengan versi lama otomatis ditolak.',
      },
      accountStatus: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
      mustChangePassword: {
        type: 'boolean',
        description: 'Bila true, seluruh modul selain /api/auth/me, /api/auth/logout, dan ganti password dibalas 403.',
      },
      umlAccess: { description: 'Boolean, atau objek berisi detail persetujuan akses UML.' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      lastLogin: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'nip', 'name', 'email', 'role'],
  },

  AuthResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', enum: [true] },
      message: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          token: { type: 'string', description: 'JWT untuk header Authorization: Bearer <token>.' },
        },
        required: ['user', 'token'],
      },
    },
    required: ['success', 'message'],
  },

  Borrowing: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      borrowingCode: { type: 'string', example: 'PJM-2026-0142' },
      assetId: { type: 'integer' },
      assetType: { type: 'string', enum: ['medical', 'non_medical'] },
      userId: { type: 'integer' },
      assetName: { type: 'string' },
      assetCode: { type: 'string' },
      assetDetailId: { type: 'string' },
      assetDetailName: { type: 'string' },
      assetDetailCode: { type: 'string' },
      assetLocation: { type: 'string' },
      userName: { type: 'string' },
      userNip: { type: 'string' },
      userEmail: { type: 'string', format: 'email' },
      borrowerRole: { type: 'string' },
      borrowerPosition: { type: 'string' },
      borrowerWorkUnit: { type: 'string' },
      borrowerCurrentWorkUnit: { type: 'string' },
      ownerUserId: { type: 'integer', description: 'Akun aktif Pemilik/PJ inventaris bila tertaut.' },
      ownerName: { type: 'string' },
      ownerNip: { type: 'string' },
      ownerPosition: { type: 'string' },
      ownerWorkUnit: { type: 'string' },
      borrowDate: { type: 'string', format: 'date-time' },
      dueDate: { type: 'string', format: 'date-time' },
      returnDate: { type: 'string', format: 'date-time' },
      status: { $ref: '#/components/schemas/BorrowingStatus' },
      purpose: { type: 'string' },
      purposeType: { type: 'string', enum: ['inside_hospital', 'outside_hospital'] },
      destinationRoom: { type: 'string' },
      loanDurationValue: { type: 'integer', minimum: 1 },
      loanDurationUnit: { type: 'string', enum: ['day', 'month', 'year'] },
      quantity: { type: 'integer', minimum: 1 },
      notes: { type: 'string' },
      approvedBy: { type: 'integer' },
      approvedAt: { type: 'string', format: 'date-time' },
      rejectedBy: { type: 'integer' },
      rejectedAt: { type: 'string', format: 'date-time' },
      rejectionReason: { type: 'string' },
      returnCondition: { type: 'string' },
      returnNotes: { type: 'string' },
      returnValidatedBy: { type: 'integer' },
      returnValidatedAt: { type: 'string', format: 'date-time' },
      returnValidatorName: { type: 'string' },
      returnValidatorNip: { type: 'string' },
      returnedBy: { type: 'integer' },
      returnedByName: { type: 'string' },
      returnedByNip: { type: 'string' },
      overdueDays: { type: 'integer', minimum: 0 },
      sanctionStatus: { type: 'string', enum: ['none', 'active', 'resolved'] },
      sanctionNotes: { type: 'string' },
      sanctionAppliedAt: { type: 'string', format: 'date-time' },
      extensionCount: { type: 'integer', minimum: 0 },
      lastExtendedDate: { type: 'string', format: 'date-time' },
      extensionNotes: { type: 'string' },
      isExtensionBlocked: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'borrowingCode', 'assetId', 'userId', 'borrowDate', 'status', 'purpose'],
  },

  BorrowingStatus: {
    type: 'string',
    enum: ['pending', 'approved', 'rejected', 'borrowed', 'returned', 'overdue'],
  },

  HealthResponse: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['OK', 'DEGRADED'],
        description: 'DEGRADED bila database atau skema belum siap. Status HTTP tetap 200 agar probe tidak mematikan container saat startup.',
      },
      timestamp: { type: 'string', format: 'date-time' },
      uptime: { type: 'number', description: 'Detik sejak proses dimulai.' },
      environment: { type: 'string', example: 'production' },
      services: {
        type: 'object',
        properties: {
          database: { type: 'string', enum: ['initializing', 'up', 'down'] },
          schema: { type: 'string', enum: ['initializing', 'up', 'down'] },
          redis: { type: 'string', enum: ['initializing', 'up', 'down', 'optional-down'] },
        },
      },
      requestId: { type: 'string', format: 'uuid' },
    },
  },

  ServerTimeResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', enum: [true] },
      message: { type: 'string' },
      data: {
        type: 'object',
        description: 'Snapshot waktu server; dipakai frontend untuk menyelaraskan perhitungan jatuh tempo.',
      },
    },
  },
};

/** Response yang sering dipakai ulang di banyak operasi. */
export const responses: Record<string, unknown> = {
  ValidationError: {
    description: 'Validasi request gagal.',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } },
    },
  },
  Unauthorized: {
    description: 'Token tidak ada, tidak valid, kedaluwarsa, atau sesi sudah di-invalidate.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  Forbidden: {
    description: 'Peran tidak mencukupi, akun nonaktif/ditangguhkan, atau pengguna wajib mengganti password lebih dulu.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  NotFound: {
    description: 'Sumber daya tidak ditemukan.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  Conflict: {
    description: 'Bentrok dengan kondisi data saat ini.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  TooManyRequests: {
    description: 'Batas rate limit terlampaui.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  InternalError: {
    description: 'Kesalahan tak terduga di server.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
};

export const securitySchemes: Record<string, unknown> = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'JWT dari `POST /api/auth/login`, dikirim sebagai `Authorization: Bearer <token>`. ' +
      'Token ikut membawa `sessionVersion`; logout dan reset password menaikkan versi tersebut sehingga token lama langsung ditolak.',
  },
};
