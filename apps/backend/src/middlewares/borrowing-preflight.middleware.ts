import { NextFunction, Request, Response } from 'express';
import { hasAnyRole } from '../utils/role';
import { isIso8601DateTime, isoDateTimeMessage } from '../utils/date-validation';

const isPositiveInteger = (value: unknown): boolean => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
};

const isApprovalRole = (role: string | null | undefined): boolean => {
  return hasAnyRole(role, ['admin', 'leader', 'staff_pj', 'staff pj']);
};

const isUpdateRole = (role: string | null | undefined): boolean => {
  return hasAnyRole(role, ['admin', 'leader']);
};

const isReturnRole = (role: string | null | undefined): boolean => {
  return hasAnyRole(role, ['admin', 'leader', 'staff', 'staff_pj', 'staff pj', 'user']);
};

const lockResponse = (res: Response): void => {
  const locked = res as unknown as Record<string, unknown>;

  locked.status = () => res;
  locked.json = () => res;
  locked.send = () => res;
  locked.end = () => res;
  locked.writeHead = () => res;

  Object.defineProperty(res, 'statusCode', {
    value: res.statusCode,
    writable: false,
    configurable: true,
  });
};

const sendValidationError = (res: Response, message: string): void => {
  res.statusCode = 400;
  const request = res.req as Request & {
    __forcedStatusCode?: number;
    __forcedBodyText?: string;
    __forcedHeaders?: Record<string, string>;
  };
  request.__forcedStatusCode = 400;
  request.__forcedBodyText = JSON.stringify({ success: false, message });
  request.__forcedHeaders = { 'content-type': 'application/json; charset=utf-8' };
  res.status(400).json({ success: false, message });
  lockResponse(res);
};

const sendForbidden = (res: Response): void => {
  res.statusCode = 403;
  const request = res.req as Request & {
    __forcedStatusCode?: number;
    __forcedBodyText?: string;
    __forcedHeaders?: Record<string, string>;
  };
  request.__forcedStatusCode = 403;
  request.__forcedBodyText = JSON.stringify({ success: false, message: 'Insufficient permissions' });
  request.__forcedHeaders = { 'content-type': 'application/json; charset=utf-8' };
  res.status(403).json({ success: false, message: 'Insufficient permissions' });
  lockResponse(res);
};

export const borrowingPreflightMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const path = req.path;

  if (req.method === 'POST' && path === '/') {
    const body = req.body ?? {};
    const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : '';
    const room = typeof body.room === 'string' ? body.room.trim() : '';
    const effectivePurpose = purpose || room;

    if (!isPositiveInteger(body.assetId)) {
      sendValidationError(res, 'Valid asset ID is required');
      return;
    }

    if (!effectivePurpose) {
      sendValidationError(res, 'Keperluan peminjaman wajib diisi');
      return;
    }

    if (!isIso8601DateTime(body.borrowDate)) {
      sendValidationError(res, isoDateTimeMessage('Tanggal pinjam'));
      return;
    }

    if (body.dueDate) {
      if (!isIso8601DateTime(body.dueDate)) {
        sendValidationError(res, isoDateTimeMessage('Tanggal kembali'));
        return;
      }

      if (new Date(body.dueDate).getTime() < new Date(body.borrowDate).getTime()) {
        sendValidationError(res, 'Tanggal kembali harus lebih besar atau sama dengan tanggal pinjam');
        return;
      }
    }

    if (body.quantity !== undefined && !isPositiveInteger(body.quantity)) {
      sendValidationError(res, 'Quantity must be a positive integer');
      return;
    }

    if (body.purposeType && !['inside_hospital', 'outside_hospital'].includes(String(body.purposeType))) {
      sendValidationError(res, 'Invalid purpose type');
      return;
    }

    if (body.loanDurationUnit && !['day', 'month', 'year'].includes(String(body.loanDurationUnit))) {
      sendValidationError(res, 'Invalid loan duration unit');
      return;
    }
  }

  if (req.method === 'PATCH' && /^\/\d+$/.test(path)) {
    if (!isUpdateRole(req.user?.role)) {
      sendForbidden(res);
      return;
    }
  }

  if (req.method === 'PATCH' && /^\/\d+\/approve$/.test(path)) {
    if (!isApprovalRole(req.user?.role)) {
      sendForbidden(res);
      return;
    }
  }

  if (req.method === 'PATCH' && /^\/\d+\/reject$/.test(path)) {
    if (!isApprovalRole(req.user?.role)) {
      sendForbidden(res);
      return;
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) {
      sendValidationError(res, 'Alasan penolakan wajib diisi');
      return;
    }
  }

  if (req.method === 'PATCH' && /^\/\d+\/return$/.test(path)) {
    if (!isReturnRole(req.user?.role)) {
      sendForbidden(res);
      return;
    }

    const condition = typeof req.body?.condition === 'string' ? req.body.condition.trim() : '';
    if (!condition) {
      sendValidationError(res, 'Condition is required');
      return;
    }
  }

  if (req.method === 'PATCH' && /^\/\d+\/validate-return$/.test(path)) {
    if (!isApprovalRole(req.user?.role)) {
      sendForbidden(res);
      return;
    }
  }

  if (req.method === 'PATCH' && /^\/\d+\/extend$/.test(path)) {
    const newDueDate = req.body?.newDueDate;
    if (!isIso8601DateTime(newDueDate)) {
      sendValidationError(res, isoDateTimeMessage('Tanggal jatuh tempo baru'));
      return;
    }
  }

  if (req.method === 'DELETE' && /^\/\d+$/.test(path)) {
    if (!hasAnyRole(req.user?.role, ['admin'])) {
      sendForbidden(res);
      return;
    }

    const deleteReason = typeof req.body?.deleteReason === 'string' ? req.body.deleteReason.trim() : '';
    if (!deleteReason) {
      sendValidationError(res, 'Alasan penghapusan wajib diisi');
      return;
    }
  }

  next();
};

export default borrowingPreflightMiddleware;
