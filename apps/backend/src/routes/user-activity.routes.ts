import { Router } from 'express';
import userActivityController from '../controllers/user-activity.controller';

const router = Router();

router.get('/', userActivityController.getActivities);
router.get('/me', userActivityController.getMyActivities);

export default router;
