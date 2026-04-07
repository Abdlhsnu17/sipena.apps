import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ApiResponse, CreateUserActivityDTO, UserActivity } from '../models';

interface UserActivityRow extends RowDataPacket {
  id: number;
  user_id: number;
  feature: string;
  action: string;
  description: string;
  metadata_json: string | null;
  created_at: Date;
}

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseMetadata = (value: string | null): Record<string, any> | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const mapRow = (row: UserActivityRow): UserActivity => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  feature: row.feature,
  action: row.action,
  description: row.description,
  metadata: parseMetadata(row.metadata_json),
  createdAt: row.created_at,
});

export class UserActivityService {
  async create(payload: CreateUserActivityDTO): Promise<void> {
    const userId = toNumber(payload.userId);
    if (!userId) return;

    await pool.query<ResultSetHeader>(
      `INSERT INTO user_activity_logs (user_id, feature, action, description, metadata_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        payload.feature,
        payload.action,
        payload.description,
        payload.metadata ? JSON.stringify(payload.metadata) : null,
      ]
    );
  }

  async getByUserId(userIdValue: number | string, limitValue: number = 8): Promise<ApiResponse<UserActivity[]>> {
    const userId = toNumber(userIdValue);
    if (!userId) {
      return { success: false, message: 'User tidak valid', data: [] };
    }

    const limit = Math.max(1, Math.min(Number(limitValue) || 8, 30));

    const [rows] = await pool.query<UserActivityRow[]>(
      `SELECT id, user_id, feature, action, description, metadata_json, created_at
       FROM user_activity_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    return {
      success: true,
      message: 'Histori aktivitas berhasil diambil',
      data: rows.map(mapRow),
    };
  }
}

export const userActivityService = new UserActivityService();

export const recordUserActivity = async (payload: CreateUserActivityDTO): Promise<void> => {
  try {
    await userActivityService.create(payload);
  } catch (error) {
    console.error('Failed to record user activity:', error);
  }
};

export default userActivityService;

