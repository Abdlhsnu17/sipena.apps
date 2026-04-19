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
  home_address: string | null;
  photo_path: string | null;
}

interface CountRow extends RowDataPacket {
  count: number;
}

export class UserService {
  async getAll(filters: UserFilters): Promise<PaginatedResponse<User>> {
    const { page, limit, search, role } = filters;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at, last_login, uml_access FROM users WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
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
        'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at, last_login, uml_access FROM users WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'User not found' };
    }

    return { success: true, message: 'User retrieved successfully', data: rows[0] as User };
  }

  async create(data: CreateUserDTO): Promise<ApiResponse<User>> {
    const [existingRows] = await pool.query<UserRow[]>(
      'SELECT id FROM users WHERE nip = ? OR email = ?',
      [data.nip, data.email]
    );

    if (existingRows.length > 0) {
      return { success: false, message: 'User with this NIP or email already exists' };
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const { gender, workUnit, homeAddress, photoPath } = data;

    const normalizedRole = data.role ? normalizeRole(data.role) : 'user';

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (nip, name, email, password, role, staff_access_type, gender, work_unit, home_address, photo_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.nip,
        data.name,
        data.email,
        hashedPassword,
        normalizedRole,
        data.staffAccessType || null,
        gender || null,
        workUnit || null,
        homeAddress || null,
        photoPath || null
      ]
    );

    const [newRows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    return { success: true, message: 'User created successfully', data: newRows[0] as User };
  }

  async update(id: string, data: UpdateUserDTO): Promise<ApiResponse<User>> {
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        const normalizedValue = key === 'role' && typeof value === 'string'
          ? normalizeRole(value)
          : value;
        fields.push(`${snakeKey} = ?`);
        values.push(normalizedValue);
      }
    });

    if (fields.length === 0) {
      return { success: false, message: 'No fields to update' };
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, created_at, last_login, uml_access FROM users WHERE id = ?',
      [id]
    );

    return { success: true, message: 'User updated successfully', data: rows[0] as User };
  }

  async delete(id: string): Promise<ApiResponse> {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return { success: false, message: 'User not found' };
    }

    return { success: true, message: 'User deleted successfully' };
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

    await pool.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, id]);

    return { success: true, message: 'Password changed successfully' };
  }
}

export default new UserService();
