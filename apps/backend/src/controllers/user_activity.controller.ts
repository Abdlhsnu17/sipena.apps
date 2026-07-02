import { NextFunction, Request, Response } from 'express';
import userActivityService from '../services/user_activity.service';

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export class UserActivityController {
  getActivities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = toNumber(req.user?.id);
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const result = await userActivityService.getActivities({
        actorUserId: userId,
        actorRole: req.user?.role,
        userId: req.query.userId as string,
        page: req.query.page as string,
        limit: req.query.limit as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getMyActivities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = toNumber(req.user?.id);
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const limit = Number(req.query.limit ?? 10);
      const result = await userActivityService.getByUserId(userId, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}

export default new UserActivityController();
