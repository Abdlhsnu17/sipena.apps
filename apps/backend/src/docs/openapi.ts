import { responses, schemas, securitySchemes } from './components';
import { getOperationMeta } from './operations';
import { collectRoutes, RouteEntry } from './route-inventory';

const packageVersion = process.env.npm_package_version || '2.5.0';

/**
 * Endpoint yang didaftarkan langsung pada instance app (bukan lewat router di
 * `API_MOUNTS`), jadi tidak terjaring inventaris otomatis.
 */
const STANDALONE_PATHS: Record<string, unknown> = {
  '/health': {
    get: {
      tags: ['System'],
      summary: 'Health check',
      description:
        'Selalu membalas 200 selama proses hidup; kesiapan sebenarnya dibaca dari field `status` dan `services`. ' +
        'Dikecualikan dari rate limiter umum.',
      security: [],
      responses: {
        200: {
          description: 'Status proses dan infrastruktur.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
        },
      },
    },
  },
  '/api/health': {
    get: {
      tags: ['System'],
      summary: 'Health check (alias di bawah /api)',
      security: [],
      responses: {
        200: {
          description: 'Status proses dan infrastruktur.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
        },
      },
    },
  },
  '/api/time': {
    get: {
      tags: ['System'],
      summary: 'Waktu server',
      description: 'Dipakai frontend untuk menyelaraskan perhitungan jatuh tempo dengan jam server.',
      security: [],
      responses: {
        200: {
          description: 'Snapshot waktu server.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ServerTimeResponse' } } },
        },
      },
    },
  },
  '/api/notifications/stream': {
    get: {
      tags: ['Notifications'],
      summary: 'Stream notifikasi (Server-Sent Events)',
      description:
        'EventSource tidak dapat mengirim header Authorization, sehingga route ini memakai tiket sekali pakai ' +
        'berumur pendek dari `POST /api/notifications/stream-ticket`, bukan JWT. ' +
        'Response tidak pernah dikompresi agar event terkirim seketika.',
      security: [],
      parameters: [
        {
          name: 'ticket',
          in: 'query',
          required: true,
          description: 'Tiket sekali pakai; hangus setelah dikonsumsi.',
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Stream SSE terbuka.',
          content: { 'text/event-stream': { schema: { type: 'string' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
};

const TAG_DESCRIPTIONS: Record<string, string> = {
  System: 'Health check dan sinkronisasi waktu.',
  Auth: 'Login, registrasi, reset password, dan profil sendiri.',
  'Access Control': 'Pemetaan peran ke menu dan izin.',
  Users: 'Pengelolaan akun pengguna.',
  Assets: 'Inventaris aset medis dan non-medis.',
  'Asset Usage': 'Pencatatan penggunaan aset per ruangan dan operator.',
  Borrowing: 'Pengajuan, persetujuan, pengembalian, dan perpanjangan peminjaman.',
  'Deletion Requests': 'Alur permintaan penghapusan data.',
  DSS: 'SPK prioritas aset dengan pembobotan AHP dan pemeringkatan TOPSIS.',
  Maintenance: 'Tiket dan jadwal pemeliharaan.',
  'Maintenance History': 'Riwayat pemeliharaan aset.',
  Reports: 'Laporan operasional dan unggahan dokumen.',
  UML: 'Dokumentasi sistem dan diagram.',
  'User Activities': 'Jejak aktivitas pengguna.',
  Sanctions: 'Sanksi keterlambatan pengembalian.',
  'Asset Disposal': 'Pengajuan penghapusan/pemusnahan aset.',
  Notifications: 'Notifikasi dalam aplikasi dan stream real-time.',
  'App Settings': 'Pengaturan global aplikasi, seperti teks pemberitahuan berjalan.',
};

/** Response yang berlaku untuk hampir semua endpoint di bawah /api. */
const buildDefaultResponses = (route: RouteEntry): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {
    200: {
      description: 'Permintaan berhasil.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', enum: [true] },
              message: { type: 'string' },
              data: { description: 'Muatan spesifik per endpoint.' },
            },
            required: ['success', 'message'],
          },
        },
      },
    },
    400: { $ref: '#/components/responses/ValidationError' },
    429: { $ref: '#/components/responses/TooManyRequests' },
    500: { $ref: '#/components/responses/InternalError' },
  };

  if (route.requiresAuth) {
    defaults[401] = { $ref: '#/components/responses/Unauthorized' };
    defaults[403] = { $ref: '#/components/responses/Forbidden' };
  }

  return defaults;
};

const buildPathParameters = (route: RouteEntry): unknown[] =>
  route.pathParams.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'integer', minimum: 1 },
  }));

const buildOperation = (route: RouteEntry): Record<string, unknown> => {
  const meta = getOperationMeta(route.key);
  const parameters = [...buildPathParameters(route), ...((meta?.parameters as unknown[]) ?? [])];

  const operation: Record<string, unknown> = {
    tags: [route.tag],
    operationId: route.key.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    summary: meta?.summary ?? `${route.method.toUpperCase()} ${route.openApiPath}`,
    responses: { ...buildDefaultResponses(route), ...(meta?.responses ?? {}) },
  };

  const descriptionParts: string[] = [];
  if (meta?.description) {
    descriptionParts.push(meta.description);
  }
  if (meta?.roles?.length) {
    descriptionParts.push(`**Peran yang diizinkan:** ${meta.roles.join(', ')}.`);
  }
  if (!meta) {
    descriptionParts.push(
      'Belum didokumentasikan secara rinci. Path, metode, dan kebutuhan autentikasi diturunkan ' +
        'langsung dari definisi route, tetapi schema body dan response masih generik.',
    );
  }
  if (descriptionParts.length > 0) {
    operation.description = descriptionParts.join('\n\n');
  }

  if (parameters.length > 0) {
    operation.parameters = parameters;
  }

  if (meta?.requestBody) {
    operation.requestBody = meta.requestBody;
  }

  // Endpoint tanpa auth di level mount tidak memakai security requirement global.
  if (!route.requiresAuth) {
    operation.security = [];
  }

  return operation;
};

export interface OpenApiDocument {
  openapi: string;
  info: Record<string, unknown>;
  servers: unknown[];
  tags: unknown[];
  security: unknown[];
  paths: Record<string, Record<string, unknown>>;
  components: Record<string, unknown>;
}

/**
 * Menyusun dokumen OpenAPI 3.1 dari route yang benar-benar terpasang.
 *
 * Inventaris route menentukan endpoint mana yang muncul; `operations.ts`
 * memperkaya endpoint yang sudah didokumentasikan rinci. Endpoint yang belum
 * punya metadata tetap tampil dengan path, metode, parameter path, dan status
 * autentikasi yang benar.
 */
export const buildOpenApiDocument = (): OpenApiDocument => {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of collectRoutes()) {
    paths[route.openApiPath] ??= {};
    paths[route.openApiPath][route.method] = buildOperation(route);
  }

  for (const [path, operations] of Object.entries(STANDALONE_PATHS)) {
    paths[path] = { ...(paths[path] ?? {}), ...(operations as Record<string, unknown>) };
  }

  const usedTags = new Set<string>();
  for (const operations of Object.values(paths)) {
    for (const operation of Object.values(operations)) {
      for (const tag of (operation as { tags?: string[] }).tags ?? []) {
        usedTags.add(tag);
      }
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'SIPENA API',
      version: packageVersion,
      description:
        'REST API untuk Sistem Inventaris, Peminjaman, dan Pemeliharaan Sarana (SIPENA).\n\n' +
        'Seluruh endpoint di bawah `/api` selain `/api/auth`, `/api/health`, `/api/time`, dan `/api/docs` ' +
        'memerlukan header `Authorization: Bearer <token>`.\n\n' +
        'Setiap response membawa header `X-Request-Id` yang juga muncul di log server — sertakan nilai ini ' +
        'saat melaporkan masalah.\n\n' +
        'Daftar endpoint di dokumen ini dibangkitkan dari definisi route yang benar-benar terpasang, ' +
        'sehingga tidak dapat menyimpang dari perilaku server.',
    },
    servers: [
      { url: '/', description: 'Server saat ini' },
      { url: 'http://localhost:4000', description: 'Pengembangan lokal' },
    ],
    tags: Array.from(usedTags)
      .sort()
      .map((name) => ({ name, description: TAG_DESCRIPTIONS[name] })),
    security: [{ bearerAuth: [] }],
    paths,
    components: { schemas, responses, securitySchemes },
  };
};
