import { Router } from 'express';
import accessControlController from '../controllers/access-control.controller';
import { requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/me/menus', accessControlController.getMyMenus);
router.get('/matrix', requireRole(['admin']), accessControlController.getMatrix);
router.put('/roles/:roleCode/menus', requireRole(['admin']), accessControlController.updateRoleMenus);

export default router;
