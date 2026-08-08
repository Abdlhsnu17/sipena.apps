import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './openapi';
import { documentedOperationKeys } from './operations';
import { buildRouteKey, collectRoutes } from './route-inventory';

const document = buildOpenApiDocument();
const routes = collectRoutes();

/** Mengumpulkan setiap nilai `$ref` di seluruh dokumen. */
const collectRefs = (node: unknown, found: string[] = []): string[] => {
  if (Array.isArray(node)) {
    node.forEach((item) => collectRefs(item, found));
    return found;
  }

  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') {
        found.push(value);
      } else {
        collectRefs(value, found);
      }
    }
  }

  return found;
};

/** Menyelesaikan pointer JSON lokal seperti `#/components/schemas/User`. */
const resolveRef = (ref: string): unknown => {
  if (!ref.startsWith('#/')) {
    return undefined;
  }

  return ref
    .slice(2)
    .split('/')
    .reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      return (current as Record<string, unknown>)[segment];
    }, document as unknown);
};

describe('inventaris route', () => {
  it('menemukan endpoint dari setiap router yang terpasang', () => {
    expect(routes.length).toBeGreaterThan(90);
  });

  it('mengubah parameter path Express menjadi gaya OpenAPI', () => {
    const route = routes.find((entry) => entry.expressPath === '/api/borrowing/:id/approve');

    expect(route).toBeDefined();
    expect(route?.openApiPath).toBe('/api/borrowing/{id}/approve');
    expect(route?.pathParams).toEqual(['id']);
    expect(route?.key).toBe('PATCH /api/borrowing/{id}/approve');
  });

  it('menangkap parameter path bersarang', () => {
    const route = routes.find((entry) => entry.expressPath === '/api/borrowing/user/:userId/blocking');

    expect(route?.openApiPath).toBe('/api/borrowing/user/{userId}/blocking');
    expect(route?.pathParams).toEqual(['userId']);
  });

  it('menandai hanya /api/auth sebagai mount tanpa autentikasi', () => {
    const unauthenticatedPrefixes = new Set(
      routes.filter((entry) => !entry.requiresAuth).map((entry) => entry.openApiPath.split('/')[2]),
    );

    expect(Array.from(unauthenticatedPrefixes)).toEqual(['auth']);
  });

  it('tidak menghasilkan path duplikat untuk metode yang sama', () => {
    const keys = routes.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('dokumen OpenAPI', () => {
  it('mencantumkan setiap route yang terpasang', () => {
    const missing = routes.filter((route) => {
      const pathItem = document.paths[route.openApiPath] as Record<string, unknown> | undefined;
      return !pathItem || !pathItem[route.method];
    });

    expect(missing.map((route) => route.key)).toEqual([]);
  });

  it('tidak menyimpan metadata untuk route yang sudah tidak ada', () => {
    const liveKeys = new Set(routes.map((route) => route.key));
    const stale = documentedOperationKeys().filter((key) => !liveKeys.has(key));

    expect(stale).toEqual([]);
  });

  it('menyertakan endpoint yang didaftarkan langsung di app', () => {
    expect(document.paths['/health']).toBeDefined();
    expect(document.paths['/api/health']).toBeDefined();
    expect(document.paths['/api/time']).toBeDefined();
    expect(document.paths['/api/notifications/stream']).toBeDefined();
  });

  it('menerapkan bearer auth secara global dan mengecualikan endpoint publik', () => {
    expect(document.security).toEqual([{ bearerAuth: [] }]);

    const login = document.paths['/api/auth/login'].post as Record<string, unknown>;
    expect(login.security).toEqual([]);

    const listBorrowing = document.paths['/api/borrowing'].get as Record<string, unknown>;
    expect(listBorrowing.security).toBeUndefined();
  });

  it('memberi endpoint terproteksi response 401 dan 403', () => {
    const listBorrowing = document.paths['/api/borrowing'].get as {
      responses: Record<string, unknown>;
    };

    expect(listBorrowing.responses['401']).toBeDefined();
    expect(listBorrowing.responses['403']).toBeDefined();
  });

  it('tidak memberi 401/403 pada endpoint tanpa autentikasi level mount', () => {
    const login = document.paths['/api/auth/login'].post as { responses: Record<string, unknown> };

    expect(login.responses['401']).toBeDefined(); // login memang punya 401 khusus
    expect(login.responses['403']).toBeUndefined();
  });

  it('memakai metadata tulisan tangan bila tersedia', () => {
    const approve = document.paths['/api/borrowing/{id}/approve'].patch as Record<string, string>;

    expect(approve.summary).toBe('Setujui peminjaman');
    expect(approve.description).toContain('admin, leader, staff_pj');
  });

  it('menandai endpoint yang belum didokumentasikan rinci', () => {
    const documented = new Set(documentedOperationKeys());
    const undocumented = routes.find((route) => !documented.has(route.key));

    if (!undocumented) {
      return; // seluruh endpoint sudah didokumentasikan
    }

    const operation = (document.paths[undocumented.openApiPath] as Record<string, { description?: string }>)[
      undocumented.method
    ];
    expect(operation.description).toContain('Belum didokumentasikan');
  });

  it('mendeklarasikan parameter path untuk setiap segmen bertanda', () => {
    const operation = document.paths['/api/borrowing/{id}/reject'].patch as {
      parameters: { name: string; in: string; required: boolean }[];
    };
    const pathParam = operation.parameters.find((parameter) => parameter.in === 'path');

    expect(pathParam).toMatchObject({ name: 'id', in: 'path', required: true });
  });

  it('menggabungkan parameter query dengan parameter path', () => {
    const operation = document.paths['/api/borrowing'].get as {
      parameters: { name: string; in: string }[];
    };
    const names = operation.parameters.map((parameter) => parameter.name);

    expect(names).toContain('page');
    expect(names).toContain('status');
  });

  it('memberi operationId unik pada setiap operasi', () => {
    const operationIds: string[] = [];

    for (const pathItem of Object.values(document.paths)) {
      for (const operation of Object.values(pathItem)) {
        const id = (operation as { operationId?: string }).operationId;
        if (id) {
          operationIds.push(id);
        }
      }
    }

    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('menyelesaikan seluruh $ref ke node yang benar-benar ada', () => {
    const unresolved = Array.from(new Set(collectRefs(document))).filter(
      (ref) => resolveRef(ref) === undefined,
    );

    expect(unresolved).toEqual([]);
  });

  it('memakai versi OpenAPI dan skema keamanan yang diharapkan', () => {
    expect(document.openapi).toBe('3.1.0');
    expect((document.components.securitySchemes as Record<string, { scheme: string }>).bearerAuth.scheme).toBe(
      'bearer',
    );
  });

  it('mendaftarkan tag hanya untuk yang benar-benar dipakai', () => {
    const declared = (document.tags as { name: string }[]).map((tag) => tag.name);
    const used = new Set<string>();

    for (const pathItem of Object.values(document.paths)) {
      for (const operation of Object.values(pathItem)) {
        for (const tag of (operation as { tags?: string[] }).tags ?? []) {
          used.add(tag);
        }
      }
    }

    expect(declared.slice().sort()).toEqual(Array.from(used).sort());
  });

  it('mendokumentasikan seluruh endpoint auth dan borrowing secara rinci', () => {
    const documented = new Set(documentedOperationKeys());
    const coreRoutes = routes.filter(
      (route) => route.tag === 'Auth' || route.tag === 'Borrowing',
    );
    const missing = coreRoutes.filter((route) => !documented.has(route.key));

    expect(missing.map((route) => route.key)).toEqual([]);
  });

  it('mendokumentasikan stream SSE sebagai berbasis tiket, bukan bearer', () => {
    const stream = document.paths['/api/notifications/stream'].get as {
      security: unknown[];
      parameters: { name: string; required: boolean }[];
    };

    expect(stream.security).toEqual([]);
    expect(stream.parameters[0]).toMatchObject({ name: 'ticket', required: true });
  });

  it('menjaga kunci metadata tetap memakai format buildRouteKey', () => {
    for (const key of documentedOperationKeys()) {
      const [method, path] = key.split(' ');
      expect(key).toBe(buildRouteKey(method, path));
    }
  });
});
