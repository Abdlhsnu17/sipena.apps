import { Router } from 'express';
import userActivityController from '../controllers/user_activity.controller';

const router = Router();

router.get('/me', userActivityController.getMyActivities);

export default router;

