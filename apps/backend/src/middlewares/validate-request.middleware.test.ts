import { NextFunction, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { describe, expect, it, vi } from 'vitest';
import { validateRequest } from './validate-request.middleware';

/**
 * Menjalankan rantai validator lalu middleware, meniru urutan eksekusi Express.
 */
const run = async (
  validators: ReturnType<typeof body>[],
  req: Partial<Request>
): Promise<{ status: number | null; payload: any; nextCalled: boolean }> => {
  const request = { body: {}, query: {}, params: {}, headers: {}, cookies: {}, ...req } as Request;

  for (const validator of validators) {
    await validator.run(request);
  }

  let status: number | null = null;
  let payload: any = null;
  let nextCalled = false;

  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    nextCalled = true;
  };

  validateRequest(request, res, next);
  return { status, payload, nextCalled };
};

describe('validateRequest', () => {
  it('meneruskan request yang valid ke handler berikutnya', async () => {
    const result = await run([body('nip').trim().notEmpty()], { body: { nip: '198765' } });

    expect(result.nextCalled).toBe(true);
    expect(result.status).toBeNull();
  });

  it('menolak request tidak valid dengan status 400 dan tidak memanggil next', async () => {
    const result = await run([body('nip').trim().notEmpty()], { body: { nip: '   ' } });

    expect(result.nextCalled).toBe(false);
    expect(result.status).toBe(400);
    expect(result.payload.success).toBe(false);
    expect(Array.isArray(result.payload.errors)).toBe(true);
  });

  it('memakai pesan .withMessage() sebagai message agar tampil di form', async () => {
    const result = await run(
      [body('password').notEmpty().withMessage('Password wajib diisi')],
      { body: {} }
    );

    expect(result.payload.message).toBe('Password wajib diisi');
  });

  it('memakai message generik ketika validator tidak punya pesan khusus', async () => {
    const result = await run([query('page').optional().isInt({ min: 1 })], {
      query: { page: 'abc' } as any,
    });

    expect(result.status).toBe(400);
    expect(result.payload.message).toBe('Validation failed');
  });

  it('menolak tanggal yang tidak valid pada query laporan', async () => {
    const result = await run([query('startDate').optional().isISO8601()], {
      query: { startDate: 'bukan-tanggal' } as any,
    });

    expect(result.status).toBe(400);
    expect(result.nextCalled).toBe(false);
  });

  it('menolak menuCodes non-array yang sebelumnya menghapus seluruh menu role', async () => {
    const result = await run(
      [body('menuCodes').isArray().withMessage('menuCodes harus berupa array')],
      { body: { menuCodes: 'oops' } }
    );

    expect(result.status).toBe(400);
    expect(result.payload.message).toBe('menuCodes harus berupa array');
  });

  it('tidak mengembalikan 400 ketika tidak ada validator yang dijalankan', async () => {
    const result = await run([], { body: { apa: 'saja' } });

    expect(result.nextCalled).toBe(true);
  });

  it('membiarkan nilai hasil sanitasi validator dipakai handler', async () => {
    const request = { body: {}, query: { limit: '25' }, params: {} } as unknown as Request;
    await query('limit').optional().isInt({ min: 1, max: 100 }).toInt().run(request);

    expect(validationResult(request).isEmpty()).toBe(true);
    expect((request.query as any).limit).toBe(25);
  });

  it('tidak menulis response lebih dari sekali', async () => {
    const request = { body: {}, query: {}, params: {} } as unknown as Request;
    await body('wajib').notEmpty().run(request);

    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as unknown as Response;
    const next = vi.fn();

    validateRequest(request, res, next);

    expect(json).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });
});
