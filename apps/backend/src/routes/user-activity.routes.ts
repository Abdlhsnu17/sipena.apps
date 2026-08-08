import { Router } from 'express';
import { query } from 'express-validator';
import userActivityController from '../controllers/user-activity.controller';
import { validateRequest } from '../middlewares/validate-request.middleware';

const router = Router();

router.get(
  '/',
  [
    query('userId').optional().isInt({ min: 1 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validateRequest,
  ],
  userActivityController.getActivities
);

router.get(
  '/me',
  [query('limit').optional().isInt({ min: 1, max: 100 }).toInt(), validateRequest],
  userActivityController.getMyActivities
);

export default router;
