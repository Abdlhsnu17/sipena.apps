import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../types/auth';
import { hasAnyRole } from '../utils/role';

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
    
    const decoded = jwt.verify(token, jwtSecret) as User;
    req.user = decoded;
    
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
