import bcrypt from 'bcryptjs';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
  ApiResponse,
  CreateUserDTO,
  PaginatedResponse,
  UpdateUserDTO,
  User,
  UserFilters
} from '../models';
import { isValidPhoneNumber, normalizePhoneNumberForStorage } from '../utils/otp-delivery';
import { normalizeRole } from '../utils/role';

interface UserRow extends RowDataPacket {
  id: number;
  nip: string;
  name: string;
  email: string;
  password: string;
  role: string;
  staff_access_type: string;
  created_at: Date;
  last_login: Date;
  uml_access: boolean;
  gender: string | null;
  work_unit: string | null;
  sub_work_unit: string | null;
  home_address: string | null;
  phone_number: string | null;
  photo_path: string | null;
  account_status: 'active' | 'inactive' | 'suspended' | null;
  must_change_password: number | boolean;
  deleted_at: Date | null;
  deleted_by: number | null;
  delete_reason: string | null;
}

interface CountRow extends RowDataPacket {
  count: number;
}

export class UserService {
  async getAll(filters: UserFilters): Promise<PaginatedResponse<User>> {
    const { page, limit, search, role } = filters;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, photo_path, created_at, last_login, uml_access, account_status, must_change_password, deleted_at, deleted_by, delete_reason FROM users WHERE deleted_at IS NULL';
    let countQuery = 'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (search) {
      query += ' AND (name LIKE ? OR nip LIKE ? OR email LIKE ?)';
      countQuery += ' AND (name LIKE ? OR nip LIKE ? OR email LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (role) {
      query += ' AND role = ?';
      countQuery += ' AND role = ?';
      params.push(role);
    }

    const countParams = [...params];
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [dataRows] = await pool.query<UserRow[]>(query, params);
    const [countRows] = await pool.query<CountRow[]>(countQuery, countParams);

    const total = countRows[0].count;

    return {
      success: true,
      message: 'Users retrieved successfully',
      data: dataRows as User[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getById(id: string): Promise<ApiResponse<User>> {
    const [rows] = await pool.query<UserRow[]>(
        'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, photo_path, created_at, last_login, uml_access, account_status, must_change_password, deleted_at, deleted_by, delete_reason FROM users WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'User not found' };
    }

    return { success: true, message: 'User retrieved successfully', data: rows[0] as User };
  }

  async create(data: CreateUserDTO): Promise<ApiResponse<User>> {
    const normalizedPhoneNumber = data.phoneNumber ? normalizePhoneNumberForStorage(data.phoneNumber) : '';
    if (!normalizedPhoneNumber || !isValidPhoneNumber(normalizedPhoneNumber)) {
      return { success: false, message: 'Nomor WhatsApp/SMS tidak valid' };
    }

    const [existingRows] = await pool.query<UserRow[]>(
      'SELECT id FROM users WHERE deleted_at IS NULL AND (nip = ? OR email = ? OR phone_number = ?)',
      [data.nip, data.email, normalizedPhoneNumber]
    );

    if (existingRows.length > 0) {
      return { success: false, message: 'User with this NIP or email already exists' };
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const { gender, workUnit, subWorkUnit, homeAddress, photoPath } = data;

    const normalizedRole = data.role ? normalizeRole(data.role) : 'user';

    const accountStatus = data.accountStatus || 'active';
    const mustChangePassword = data.mustChangePassword ?? true;

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (nip, name, email, password, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, photo_path, is_active, account_status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.nip,
        data.name,
        data.email,
        hashedPassword,
        normalizedRole,
        data.staffAccessType || null,
        gender || null,
        workUnit || null,
        subWorkUnit || null,
        homeAddress || null,
        normalizedPhoneNumber,
        photoPath || null,
        accountStatus === 'active' ? 1 : 0,
        accountStatus,
        mustChangePassword ? 1 : 0
      ]
    );

    const [newRows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, created_at, account_status, must_change_password FROM users WHERE id = ?',
      [result.insertId]
    );

    return { success: true, message: 'User created successfully', data: newRows[0] as User };
  }

  async update(id: string, data: UpdateUserDTO): Promise<ApiResponse<User>> {
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    if (data.phoneNumber !== undefined) {
      if (data.phoneNumber && !isValidPhoneNumber(data.phoneNumber)) {
        return { success: false, message: 'Nomor WhatsApp/SMS tidak valid' };
      }

      const normalizedPhoneNumber = data.phoneNumber ? normalizePhoneNumberForStorage(data.phoneNumber) : null;
      const [duplicateRows] = await pool.query<UserRow[]>(
        'SELECT id FROM users WHERE phone_number = ? AND id <> ? AND deleted_at IS NULL LIMIT 1',
        [normalizedPhoneNumber, id],
      );

      if (duplicateRows.length > 0) {
        return { success: false, message: 'Nomor WhatsApp/SMS sudah digunakan' };
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        const normalizedValue = key === 'role' && typeof value === 'string'
          ? normalizeRole(value)
          : key === 'phoneNumber' && typeof value === 'string'
            ? normalizePhoneNumberForStorage(value)
          : key === 'mustChangePassword'
            ? value ? 1 : 0
          : value;
        fields.push(`${snakeKey} = ?`);
        values.push(normalizedValue);
      }
    });

    if (data.accountStatus !== undefined) {
      fields.push('is_active = ?');
      values.push(data.accountStatus === 'active' ? 1 : 0);
    }

    if (fields.length === 0) {
      return { success: false, message: 'No fields to update' };
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, photo_path, created_at, last_login, uml_access, account_status, must_change_password, deleted_at, deleted_by, delete_reason FROM users WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    return { success: true, message: 'User updated successfully', data: rows[0] as User };
  }

  async delete(id: string, deletedBy?: number, deleteReason?: string): Promise<ApiResponse> {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE users
       SET deleted_at = NOW(),
           deleted_by = ?,
           delete_reason = ?,
           account_status = 'inactive',
           is_active = 0,
           session_version = session_version + 1,
           updated_at = NOW()
       WHERE id = ?
         AND deleted_at IS NULL`,
      [deletedBy ?? null, deleteReason?.trim() || null, id]
    );

    if (result.affectedRows === 0) {
      return { success: false, message: 'User not found' };
    }

    return { success: true, message: 'Pengguna diarsipkan' };
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<ApiResponse> {
    const [rows] = await pool.query<UserRow[]>('SELECT password FROM users WHERE id = ?', [id]);

    if (rows.length === 0) {
      return { success: false, message: 'User not found' };
    }

    const isValidPassword = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isValidPassword) {
      return { success: false, message: 'Current password is incorrect' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password = ?, must_change_password = 0, session_version = session_version + 1, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id],
    );

    return { success: true, message: 'Password changed successfully' };
  }

  async resetPassword(id: string, newPassword: string): Promise<ApiResponse> {
    const [rows] = await pool.query<UserRow[]>('SELECT id FROM users WHERE id = ?', [id]);

    if (rows.length === 0) {
      return { success: false, message: 'User not found' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password = ?, must_change_password = 1, session_version = session_version + 1, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id],
    );

    return { success: true, message: 'Password pengguna berhasil direset' };
  }
}

export default new UserService();
