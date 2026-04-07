import { Request, Response } from 'express';
import userActivityService from '../services/user_activity.service';

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export class UserActivityController {
  getMyActivities = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = toNumber(req.user?.id);
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const limit = Number(req.query.limit ?? 8);
      const result = await userActivityService.getByUserId(userId, limit);
      res.json(result);
    } catch (error) {
      console.error('Get user activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
}

export default new UserActivityController();

