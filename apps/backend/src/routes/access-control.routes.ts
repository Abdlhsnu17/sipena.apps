import { Router } from 'express';
import { body, param } from 'express-validator';
import accessControlController from '../controllers/access-control.controller';
import { requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate-request.middleware';

const router = Router();

router.get('/me/menus', accessControlController.getMyMenus);
router.get('/matrix', requireRole(['admin']), accessControlController.getMatrix);

router.put(
  '/roles/:roleCode/menus',
  requireRole(['admin']),
  [
    param('roleCode').trim().notEmpty(),
    // `menuCodes` wajib array: controller memperlakukan nilai non-array sebagai
    // daftar kosong, sehingga tanpa validator ini payload yang salah bentuk akan
    // menghapus seluruh menu milik role tersebut tanpa peringatan.
    body('menuCodes').isArray().withMessage('menuCodes harus berupa array'),
    body('menuCodes.*').isString().trim().notEmpty(),
    validateRequest,
  ],
  accessControlController.updateRoleMenus
);

export default router;
