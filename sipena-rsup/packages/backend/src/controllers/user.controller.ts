import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { UserService } from '../services/user.service';
import { hasAnyRole, normalizeRole } from '../utils/role';

const getAuthenticatedUserId = (req: Request): number | null => {
  const rawUserId = req.user?.id;
  if (rawUserId === undefined || rawUserId === null) {
    return null;
  }

  const parsedUserId = typeof rawUserId === 'number' ? rawUserId : Number(rawUserId);
  return Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;
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
      console.error('Get users error:', error);
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
      console.error('Get user error:', error);
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

      const result = await this.userService.create(req.body);

      if (!result.success) {
        res.status(409).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Create user error:', error);
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

      const result = await this.userService.update(id, req.body);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Update user error:', error);
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
      const result = await this.userService.delete(id);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
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
          // Leader dapat mengubah password semua pengguna
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
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}

export default new UserController();
