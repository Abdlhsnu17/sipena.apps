import { Request, Response } from 'express';
import { body } from 'express-validator';
import {
  DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE,
  TOPBAR_ANNOUNCEMENT_MAX_LENGTH,
  TOPBAR_ANNOUNCEMENT_STYLES,
  isTopbarAnnouncementStyle,
} from '../models/app-setting.model';
import appSettingService from '../services/app-setting.service';
import { recordUserActivity } from '../services/user-activity.service';
import { validateRequest } from '../middlewares/validate-request.middleware';

const getActorUserId = (req: Request): number | null => {
  const parsed = Number(req.user?.id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

class AppSettingController {
  /** Dibaca semua pengguna terautentikasi: teksnya tampil di topbar setiap role. */
  getAnnouncement = async (_req: Request, res: Response): Promise<void> => {
    const result = await appSettingService.getAnnouncement();
    res.status(result.success ? 200 : 400).json(result);
  };

  /** Hanya admin (dijaga `requireRole` di router). */
  updateAnnouncement = async (req: Request, res: Response): Promise<void> => {
    const actorId = getActorUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // `style` opsional agar klien lama yang hanya mengirim `value` tetap bisa
    // menyimpan tanpa diam-diam mengubah warna yang sedang dipakai.
    const requestedStyle = req.body.style;
    const style = isTopbarAnnouncementStyle(requestedStyle)
      ? requestedStyle
      : (await appSettingService.getAnnouncement()).data?.style ?? DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE;

    const result = await appSettingService.updateAnnouncement({
      value: String(req.body.value ?? ''),
      style,
      updatedBy: actorId,
    });

    if (result.success) {
      await recordUserActivity({
        userId: actorId,
        feature: 'pengaturan_sistem',
        action: 'update',
        description: 'Memperbarui teks pemberitahuan berjalan',
        metadata: {
          settingKey: 'topbar_announcement',
          value: result.data?.value,
          style: result.data?.style,
        },
      });
    }

    res.status(result.success ? 200 : 400).json(result);
  };
}

export const appSettingValidators = {
  updateAnnouncement: [
    body('value')
      .isString()
      .withMessage('Teks pemberitahuan harus berupa teks')
      .bail()
      .trim()
      .notEmpty()
      .withMessage('Teks pemberitahuan tidak boleh kosong')
      .isLength({ max: TOPBAR_ANNOUNCEMENT_MAX_LENGTH })
      .withMessage(`Teks pemberitahuan maksimal ${TOPBAR_ANNOUNCEMENT_MAX_LENGTH} karakter`),
    body('style')
      .optional()
      .isIn(TOPBAR_ANNOUNCEMENT_STYLES)
      .withMessage(`Pilihan warna harus salah satu dari: ${TOPBAR_ANNOUNCEMENT_STYLES.join(', ')}`),
    validateRequest,
  ],
};

export default new AppSettingController();
