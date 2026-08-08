import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';

/**
 * Menolak request yang gagal melewati validator express-validator.
 *
 * Pasang sebagai elemen terakhir pada rantai validator setiap route:
 *
 *   router.get('/', [query('page').optional().isInt(), validateRequest], handler);
 *
 * Dengan cara ini validator selalu ditegakkan di lapisan route, sehingga
 * controller tidak perlu (dan tidak boleh) mengulang pemeriksaan yang sama.
 * Sebelumnya pemeriksaan dilakukan manual di dalam controller dan beberapa
 * controller melewatkannya, membuat validator yang sudah dideklarasikan tidak
 * pernah berpengaruh.
 */
// Pesan bawaan express-validator ketika validator tidak memakai .withMessage().
// Nilai ini tidak informatif bagi pengguna, jadi tidak dipakai sebagai `message`.
const GENERIC_VALIDATOR_MESSAGE = 'Invalid value';

export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (process.env.DEBUG_ROUTE_TESTS === 'true') {
    const errorCount = errors.isEmpty() ? 0 : errors.array().length;
    // Debug-only trace for in-memory route tests.
    // eslint-disable-next-line no-console
    console.log('[validateRequest]', req.method, req.originalUrl, 'errors=', errorCount);
  }

  if (!errors.isEmpty()) {
    const validationErrors = errors.array();
    const safeValidationErrors = validationErrors.map((error) => ({
      type: error.type,
      msg: error.msg,
      path: (error as { path?: string }).path,
      location: (error as { location?: string }).location,
    }));
    // Form di frontend menampilkan `message` apa adanya, jadi utamakan pesan
    // eksplisit dari .withMessage() (mis. "Password wajib diisi") agar pengguna
    // tahu field mana yang salah.
    const firstMessage = String(validationErrors[0]?.msg || '').trim();

    res.status(400).json({
      success: false,
      message:
        firstMessage && firstMessage !== GENERIC_VALIDATOR_MESSAGE
          ? firstMessage
          : 'Validation failed',
      errors: safeValidationErrors,
    });
    if (process.env.DEBUG_ROUTE_TESTS === 'true') {
      // eslint-disable-next-line no-console
      console.log('[validateRequest] response sent');
    }
    return;
  }

  next();
};

export default validateRequest;
