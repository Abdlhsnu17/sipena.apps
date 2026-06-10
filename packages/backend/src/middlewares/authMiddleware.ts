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
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
      return;
    }
    
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    const [rows] = await pool.query<AuthUserRow[]>(
      `SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, photo_path, session_version, account_status, must_change_password, uml_access
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [decoded.id],
    );

    const user = rows[0];
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
      return;
    }

    if ((decoded.sessionVersion ?? 0) !== (Number(user.session_version) || 0)) {
      res.status(401).json({
        success: false,
        message: 'Session has been invalidated'
      });
      return;
    }

    if ((user.account_status || 'active') !== 'active') {
      res.status(403).json({
        success: false,
        message: user.account_status === 'suspended'
          ? 'Akun Anda sedang ditangguhkan'
          : 'Akun Anda sedang nonaktif'
      });
      return;
    }

    req.user = {
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

    const canProceedDuringPasswordChange =
      req.originalUrl === '/api/auth/me' ||
      req.originalUrl === '/api/auth/logout' ||
      /^\/api\/users\/\d+\/password$/.test(req.originalUrl);

    if (Boolean(user.must_change_password) && !canProceedDuringPasswordChange) {
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
