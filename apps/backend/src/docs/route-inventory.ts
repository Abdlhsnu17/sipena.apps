import { API_MOUNTS } from '../routes/api-mounts';

/** Metode HTTP yang didokumentasikan. */
export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface RouteEntry {
  /** Path lengkap gaya Express, mis. `/api/borrowing/:id/approve`. */
  expressPath: string;
  /** Path lengkap gaya OpenAPI, mis. `/api/borrowing/{id}/approve`. */
  openApiPath: string;
  method: HttpMethod;
  tag: string;
  /** True bila `authMiddleware` dipasang di level mount. */
  requiresAuth: boolean;
  /** Nama parameter path, diturunkan dari segmen `:param`. */
  pathParams: string[];
  /** Kunci pencarian metadata, mis. `GET /api/borrowing/{id}`. */
  key: string;
}

/**
 * Bentuk minimal dari Layer router Express yang kita baca. Express tidak
 * mengekspor tipe ini, tapi `stack[].route.path` dan `.route.methods` sudah
 * stabil lintas rilis Express 4 dan dipakai luas oleh tooling sejenis.
 */
interface RouteLayer {
  route?: {
    path: string | string[];
    methods: Record<string, boolean>;
  };
}

const toOpenApiPath = (expressPath: string): string =>
  expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

const extractPathParams = (expressPath: string): string[] =>
  Array.from(expressPath.matchAll(/:([A-Za-z0-9_]+)/g), (match) => match[1]);

/** Menggabungkan prefix mount dengan path route, menjaga agar tidak ada `//` atau trailing slash. */
const joinPath = (prefix: string, routePath: string): string => {
  const combined = `${prefix}${routePath}`.replace(/\/{2,}/g, '/');
  return combined.length > 1 ? combined.replace(/\/$/, '') : combined;
};

export const buildRouteKey = (method: string, openApiPath: string): string =>
  `${method.toUpperCase()} ${openApiPath}`;

/**
 * Menelusuri router yang benar-benar terpasang di `API_MOUNTS` dan mengembalikan
 * setiap pasangan metode/path.
 *
 * Inventaris ini dibaca langsung dari objek router, bukan dari daftar tulisan
 * tangan, sehingga endpoint baru otomatis muncul di dokumentasi begitu route-nya
 * didaftarkan.
 */
export const collectRoutes = (): RouteEntry[] => {
  const entries: RouteEntry[] = [];

  for (const mount of API_MOUNTS) {
    const stack = (mount.router as unknown as { stack?: RouteLayer[] }).stack ?? [];

    for (const layer of stack) {
      if (!layer.route) {
        continue;
      }

      const routePaths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];

      for (const routePath of routePaths) {
        const expressPath = joinPath(mount.prefix, routePath);
        const openApiPath = toOpenApiPath(expressPath);

        for (const method of HTTP_METHODS) {
          if (!layer.route.methods[method]) {
            continue;
          }

          entries.push({
            expressPath,
            openApiPath,
            method,
            tag: mount.tag,
            requiresAuth: mount.requiresAuth,
            pathParams: extractPathParams(expressPath),
            key: buildRouteKey(method, openApiPath),
          });
        }
      }
    }
  }

  return entries.sort((a, b) =>
    a.openApiPath === b.openApiPath
      ? a.method.localeCompare(b.method)
      : a.openApiPath.localeCompare(b.openApiPath),
  );
};
