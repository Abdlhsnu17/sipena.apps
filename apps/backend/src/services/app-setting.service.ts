import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ApiResponse } from '../models';
import {
  APP_SETTING_DEFAULTS,
  AppSetting,
  AppSettingKey,
  DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE,
  TopbarAnnouncement,
  UpdateAppSettingDTO,
  UpdateTopbarAnnouncementDTO,
  isTopbarAnnouncementStyle,
} from '../models/app-setting.model';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('service:app-setting');

interface AppSettingRow extends RowDataPacket {
  setting_key: AppSettingKey;
  setting_value: string | null;
  updated_by: number | null;
  updated_by_name: string | null;
  updated_at: Date | null;
}

export class AppSettingService {
  /**
   * Baca satu pengaturan. Tidak pernah gagal ke pemanggil: bila baris belum ada
   * (instalasi baru) atau query bermasalah, nilai default yang dikembalikan agar
   * UI tetap menampilkan sesuatu alih-alih kosong.
   */
  async get(key: AppSettingKey): Promise<ApiResponse<AppSetting>> {
    const fallback: AppSetting = {
      key,
      value: APP_SETTING_DEFAULTS[key],
      updatedBy: null,
      updatedByName: null,
      updatedAt: null,
    };

    try {
      const [rows] = await pool.query<AppSettingRow[]>(
        `SELECT s.setting_key, s.setting_value, s.updated_by, s.updated_at, u.name AS updated_by_name
           FROM app_settings s
           LEFT JOIN users u ON u.id = s.updated_by
          WHERE s.setting_key = ?
          LIMIT 1`,
        [key]
      );

      const row = rows[0];
      if (!row) {
        return { success: true, message: 'Pengaturan belum diatur, memakai nilai default', data: fallback };
      }

      const value = row.setting_value?.trim();
      return {
        success: true,
        message: 'Pengaturan berhasil diambil',
        data: {
          key: row.setting_key,
          // Nilai kosong diperlakukan sebagai "belum diatur" supaya marquee tidak
          // pernah tampil kosong bila admin menghapus seluruh teksnya.
          value: value || APP_SETTING_DEFAULTS[key],
          updatedBy: row.updated_by,
          updatedByName: row.updated_by_name,
          updatedAt: row.updated_at,
        },
      };
    } catch (error) {
      logger.error('Failed to read app setting', { key, error });
      return { success: true, message: 'Pengaturan tidak dapat dibaca, memakai nilai default', data: fallback };
    }
  }

  async update(dto: UpdateAppSettingDTO): Promise<ApiResponse<AppSetting>> {
    const value = dto.value.trim();

    try {
      await pool.query(
        `INSERT INTO app_settings (setting_key, setting_value, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           setting_value = VALUES(setting_value),
           updated_by = VALUES(updated_by),
           -- Ditulis eksplisit karena ON UPDATE CURRENT_TIMESTAMP tidak jalan
           -- bila admin menyimpan teks yang identik dengan nilai sebelumnya.
           updated_at = CURRENT_TIMESTAMP`,
        [dto.key, value, dto.updatedBy]
      );

      const saved = await this.get(dto.key);
      return { ...saved, message: 'Pengaturan berhasil disimpan' };
    } catch (error) {
      logger.error('Failed to update app setting', { key: dto.key, error });
      return { success: false, message: 'Pengaturan gagal disimpan' };
    }
  }

  /** Teks dan warna pemberitahuan dibaca sekaligus karena selalu tampil bersama. */
  async getAnnouncement(): Promise<ApiResponse<TopbarAnnouncement>> {
    const [text, style] = await Promise.all([
      this.get('topbar_announcement'),
      this.get('topbar_announcement_style'),
    ]);

    return {
      success: true,
      message: 'Pemberitahuan berhasil diambil',
      data: {
        value: text.data?.value ?? APP_SETTING_DEFAULTS.topbar_announcement,
        // Nilai preset yang tidak dikenal (mis. sisa dari versi lama) diturunkan
        // ke default supaya frontend tidak perlu menebak kelas warnanya.
        style: isTopbarAnnouncementStyle(style.data?.value)
          ? style.data.value
          : DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE,
        updatedBy: text.data?.updatedBy ?? null,
        updatedByName: text.data?.updatedByName ?? null,
        updatedAt: text.data?.updatedAt ?? null,
      },
    };
  }

  async updateAnnouncement(dto: UpdateTopbarAnnouncementDTO): Promise<ApiResponse<TopbarAnnouncement>> {
    const [text, style] = await Promise.all([
      this.update({ key: 'topbar_announcement', value: dto.value, updatedBy: dto.updatedBy }),
      this.update({ key: 'topbar_announcement_style', value: dto.style, updatedBy: dto.updatedBy }),
    ]);

    if (!text.success || !style.success) {
      return { success: false, message: 'Pemberitahuan gagal disimpan' };
    }

    const saved = await this.getAnnouncement();
    return { ...saved, message: 'Pemberitahuan berhasil disimpan' };
  }

  async getBrandLogo(): Promise<ApiResponse<AppSetting>> {
    return this.get('brand_logo');
  }

  async updateBrandLogo(value: string, updatedBy: number): Promise<ApiResponse<AppSetting>> {
    return this.update({ key: 'brand_logo', value, updatedBy });
  }
}

export default new AppSettingService();
