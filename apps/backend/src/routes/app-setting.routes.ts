import { Router } from 'express';
import appSettingController, { appSettingValidators } from '../controllers/app-setting.controller';
import { requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/announcement', appSettingController.getAnnouncement);

router.put(
  '/announcement',
  requireRole(['admin']),
  appSettingValidators.updateAnnouncement,
  appSettingController.updateAnnouncement
);

export default router;
