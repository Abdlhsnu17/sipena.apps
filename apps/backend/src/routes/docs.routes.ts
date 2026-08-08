import { NextFunction, Request, Response, Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from '../docs/openapi';

const router = Router();

/**
 * Dokumen dibangun sekali lalu dipakai ulang. Route sudah final begitu modul
 * selesai dimuat, jadi tidak ada gunanya menyusun ulang tiap request.
 */
let cachedDocument: ReturnType<typeof buildOpenApiDocument> | null = null;
const getDocument = () => {
  cachedDocument ??= buildOpenApiDocument();
  return cachedDocument;
};

/**
 * Helmet mengunci CSP global ke `default-src 'none'` karena backend hanya
 * melayani JSON. Swagger UI adalah satu-satunya halaman HTML yang disajikan
 * backend dan membutuhkan style serta script inline miliknya sendiri, jadi CSP
 * dilonggarkan khusus di sini — tetap tanpa origin eksternal, sehingga seluruh
 * aset dimuat dari server ini saja.
 */
const relaxCspForSwaggerUi = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  next();
};

// Spesifikasi mentah, berguna untuk klien generator dan diff di CI.
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(getDocument());
});

router.use(
  '/',
  relaxCspForSwaggerUi,
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    // `swaggerOptions.url` membuat halaman mengambil spec lewat /openapi.json,
    // sehingga hanya ada satu jalur penyajian spesifikasi.
    swaggerOptions: {
      url: '/api/docs/openapi.json',
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
    },
    customSiteTitle: 'SIPENA API',
  }),
);

export default router;
