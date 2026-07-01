import { Router } from 'express';
import accessControlController from '../controllers/access_control.controller';
import { requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.get('/me/menus', accessControlController.getMyMenus);
router.get('/matrix', requireRole(['admin']), accessControlController.getMatrix);
router.put('/roles/:roleCode/menus', requireRole(['admin']), accessControlController.updateRoleMenus);

export default router;
