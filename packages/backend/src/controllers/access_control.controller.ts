import { Request, Response } from 'express';
import accessControlService from '../services/access_control.service';

export class AccessControlController {
  getMatrix = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await accessControlService.getMatrix();
      res.json(result);
    } catch (error) {
      console.error('Get access control matrix error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  getMyMenus = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await accessControlService.getRoleMenus(req.user?.role || 'user');
      res.json(result);
    } catch (error) {
      console.error('Get role menus error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  updateRoleMenus = async (req: Request, res: Response): Promise<void> => {
    try {
      const menuCodes = Array.isArray(req.body?.menuCodes) ? req.body.menuCodes : [];
      const result = await accessControlService.updateRoleMenus(req.params.roleCode, menuCodes);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Update role menus error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}

export default new AccessControlController();
