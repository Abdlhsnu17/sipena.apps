import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { UserService } from '../services/user.service';
import { recordUserActivity } from '../services/user-activity.service';
import { hasAnyRole, normalizeRole } from '../utils/role';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('controller:user');

const getAuthenticatedUserId = (req: Request): number | null => {
  const rawUserId = req.user?.id;
  if (rawUserId === undefined || rawUserId === null) {
    return null;
  }

  const parsedUserId = typeof rawUserId === 'number' ? rawUserId : Number(rawUserId);
  return Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;
};

const PRIVILEGED_ROLES = new Set(['admin', 'leader']);

const isPrivilegedRole = (role?: string | null): boolean => {
  return PRIVILEGED_ROLES.has(normalizeRole(role));
};

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Get all users with pagination
   * GET /api/users
   */
  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        role
      } = req.query;

      const result = await this.userService.getAll({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        role: role as string
      });

      res.json(result);
    } catch (error) {
      logger.error('Get users error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.userService.getById(id);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Get user error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create new user
   * POST /api/users
   */
  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      if (normalizeRole(req.user?.role) === 'leader' && normalizeRole(req.body.role) === 'admin') {
        res.status(403).json({
          success: false,
          message: 'Leader tidak dapat membuat pengguna admin'
        });
        return;
      }

      const result = await this.userService.create(req.body);

      if (!result.success) {
        res.status(409).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      logger.error('Create user error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update user
   * PUT /api/users/:id
   */
  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const actorRole = normalizeRole(req.user?.role);
      if (actorRole === 'leader' && req.body.role !== undefined && normalizeRole(req.body.role) === 'admin') {
        res.status(403).json({
          success: false,
          message: 'Leader tidak dapat menjadikan pengguna sebagai admin'
        });
        return;
      }

      if (actorRole === 'leader') {
        const target = await this.userService.getById(id);
        if (!target.success || !target.data) {
          res.status(404).json(target);
          return;
        }

        if (isPrivilegedRole(target.data.role)) {
          res.status(403).json({
            success: false,
            message: 'Leader tidak dapat mengubah pengguna admin atau leader'
          });
          return;
        }
      }

      const result = await this.userService.update(id, req.body);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Update user error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete user
   * DELETE /api/users/:id
   */
  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const actorId = getAuthenticatedUserId(req);
      const targetUserId = Number(id);

      if (!actorId || !Number.isFinite(targetUserId)) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      if (actorId === targetUserId) {
        res.status(400).json({
          success: false,
          message: 'Tidak bisa menghapus akun sendiri'
        });
        return;
      }

      const deleteReason = typeof req.body?.deleteReason === 'string'
        ? req.body.deleteReason.trim()
        : undefined;
      if (!deleteReason || deleteReason.length < 5) {
        res.status(400).json({ success: false, message: 'Alasan penghapusan wajib diisi (minimal 5 karakter)' });
        return;
      }

      const target = await this.userService.getById(id);
      const result = await this.userService.delete(id, actorId, deleteReason);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      await recordUserActivity({
        userId: actorId,
        feature: 'pengguna',
        action: 'delete',
        description: `Mengarsipkan pengguna ${target.data?.name || `#${id}`}`,
        metadata: {
          targetUserId,
          target_user_id: targetUserId,
          targetName: target.data?.name,
          target_name: target.data?.name,
          targetNip: target.data?.nip,
          target_nip: target.data?.nip,
          deleteReason,
          delete_reason: deleteReason,
        },
      });

      res.json(result);
    } catch (error) {
      logger.error('Delete user error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Bulk delete users
   * POST /api/users/bulk-delete
   */
  bulkDelete = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const actorId = getAuthenticatedUserId(req);
      if (!actorId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const userIds = (req.body.userIds as Array<number | string>).map(Number);
      const deleteReason = String(req.body.deleteReason).trim();
      const result = await this.userService.bulkDelete(userIds, actorId, deleteReason);

      res.json(result);
    } catch (error) {
      logger.error('Bulk delete users error', { error });
      res.status(500).json({
        success: false,
        message: 'Gagal menghapus pengguna secara massal',
      });
    }
  };

  /**
   * Change user password
   * PATCH /api/users/:id/password
   */
  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;
      const actorId = getAuthenticatedUserId(req);
      const targetUserId = Number(id);

      if (!actorId || !Number.isFinite(targetUserId)) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      if (actorId !== targetUserId && !hasAnyRole(req.user?.role, ['admin'])) {
        if (normalizeRole(req.user?.role) === 'leader') {
          const target = await this.userService.getById(id);
          if (!target.success || !target.data) {
            res.status(404).json(target);
            return;
          }

          if (isPrivilegedRole(target.data.role)) {
            res.status(403).json({
              success: false,
              message: 'Leader tidak dapat mengubah password admin atau leader'
            });
            return;
          }
        } else {
          res.status(403).json({
            success: false,
            message: 'Anda tidak memiliki izin untuk mengubah password pengguna lain'
          });
          return;
        }
      }

      const result = await this.userService.changePassword(id, currentPassword, newPassword);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Change password error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Reset user password without requiring the old password.
   * PATCH /api/users/:id/password/reset
   */
  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const { newPassword } = req.body;
      const actorId = getAuthenticatedUserId(req);
      const targetUserId = Number(id);
      const actorRole = normalizeRole(req.user?.role);

      if (!actorId || !Number.isFinite(targetUserId)) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      if (!hasAnyRole(actorRole, ['admin', 'leader'])) {
        res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki izin untuk reset password pengguna'
        });
        return;
      }

      const target = await this.userService.getById(id);
      if (!target.success || !target.data) {
        res.status(404).json(target);
        return;
      }

      if (actorRole === 'leader' && isPrivilegedRole(target.data.role)) {
        res.status(403).json({
          success: false,
          message: 'Leader tidak dapat reset password admin atau leader'
        });
        return;
      }

      const result = await this.userService.resetPassword(id, newPassword);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Reset user password error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}

export default new UserController();
