import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { TokenPayload, User } from '../types/auth';
import { hasAnyRole } from '../utils/role';

interface AuthUserRow extends RowDataPacket {
  id: number;
  nip: string;
  name: string;
  email: string;
  role: string;
  staff_access_type: string | null;
  gender: string | null;
  work_unit: string | null;
  sub_work_unit: string | null;
  home_address: string | null;
  phone_number: string | null;
  photo_path: string | null;
  session_version: number;
  account_status: 'active' | 'inactive' | 'suspended' | null;
  must_change_password: number | boolean;
  uml_access: boolean;
}

type ResolvedUser =
  | { ok: true; user: User; mustChangePassword: boolean }
  | { ok: false; status: number; message: string };

/**
 * Verify a JWT and resolve the matching active user. Shared by the standard
 * header-based auth middleware and the SSE middleware (which reads the token
 * from a query string because EventSource cannot set request headers).
 */
const resolveUserFromToken = async (token: string): Promise<ResolvedUser> => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return { ok: false, status: 500, message: 'Server configuration error' };
  }

  const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
  const [rows] = await pool.query<AuthUserRow[]>(
    `SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, photo_path, session_version, account_status, must_change_password, uml_access
     FROM users
     WHERE id = ?
      AND deleted_at IS NULL
     LIMIT 1`,
    [decoded.id],
  );

  const user = rows[0];
  if (!user) {
    return { ok: false, status: 401, message: 'Invalid or expired token' };
  }

  if ((decoded.sessionVersion ?? 0) !== (Number(user.session_version) || 0)) {
    return { ok: false, status: 401, message: 'Session has been invalidated' };
  }

  if ((user.account_status || 'active') !== 'active') {
    return {
      ok: false,
      status: 403,
      message: user.account_status === 'suspended'
        ? 'Akun Anda sedang ditangguhkan'
        : 'Akun Anda sedang nonaktif',
    };
  }

  const mappedUser = {
    id: user.id,
    nip: user.nip,
    name: user.name,
    email: user.email,
    role: user.role,
    staffAccessType: user.staff_access_type,
    gender: user.gender ?? undefined,
    workUnit: user.work_unit ?? undefined,
    subWorkUnit: user.sub_work_unit ?? undefined,
    homeAddress: user.home_address ?? undefined,
    phoneNumber: user.phone_number ?? undefined,
    photoPath: user.photo_path ?? undefined,
    sessionVersion: Number(user.session_version) || 0,
    accountStatus: user.account_status || 'active',
    mustChangePassword: Boolean(user.must_change_password),
    umlAccess: user.uml_access,
  } as User;

  return { ok: true, user: mappedUser, mustChangePassword: Boolean(user.must_change_password) };
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided or invalid format'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const resolved = await resolveUserFromToken(token);
    if (!resolved.ok) {
      res.status(resolved.status).json({ success: false, message: resolved.message });
      return;
    }

    req.user = resolved.user;

    const canProceedDuringPasswordChange =
      req.originalUrl === '/api/auth/me' ||
      req.originalUrl === '/api/auth/logout' ||
      /^\/api\/users\/\d+\/password$/.test(req.originalUrl);

    if (resolved.mustChangePassword && !canProceedDuringPasswordChange) {
      res.status(403).json({
        success: false,
        message: 'Anda wajib mengganti password sebelum menggunakan modul lain'
      });
      return;
    }
    
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Authenticate an SSE connection. EventSource cannot attach an Authorization
 * header, so the JWT is accepted from the `token` query parameter (falling back
 * to a Bearer header when present). The must-change-password gate is not applied
 * here because the notification stream is a passive, read-only channel.
 */
export const sseAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const headerToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : undefined;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const token = headerToken || queryToken;

    if (!token) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const resolved = await resolveUserFromToken(token);
    if (!resolved.ok) {
      res.status(resolved.status).json({ success: false, message: resolved.message });
      return;
    }

    req.user = resolved.user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!hasAnyRole(req.user.role, roles)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};
