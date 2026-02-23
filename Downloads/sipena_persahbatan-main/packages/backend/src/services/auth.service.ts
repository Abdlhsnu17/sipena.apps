import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { AuthResponse, LoginCredentials, RegisterCredentials, User } from '../types/auth';

interface UserRow extends RowDataPacket {
  id: number;
  nip: string;
  name: string;
  email: string;
  password: string;
  role: string;
  staff_access_type: string;
  gender: string | null;
  work_unit: string | null;
  home_address: string | null;
  photo_path: string | null;
  created_at: Date;
  last_login: Date;
  uml_access: boolean;
}

interface ProfileUpdatePayload {
  name?: string;
  email?: string;
  nip?: string;
  gender?: string;
  workUnit?: string;
  homeAddress?: string;
}

export class AuthService {
  private mapRowToUser(row: UserRow): User {
    return {
      id: row.id,
      nip: row.nip,
      name: row.name,
      email: row.email,
      role: row.role,
      staffAccessType: row.staff_access_type,
      gender: row.gender ?? undefined,
      workUnit: row.work_unit ?? undefined,
      homeAddress: row.home_address ?? undefined,
      photoPath: row.photo_path ?? undefined,
      createdAt: row.created_at,
      lastLogin: row.last_login,
      umlAccess: row.uml_access
    };
  }

  /**
   * Authenticate user login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { nip, password } = credentials;

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, password, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at, last_login, uml_access FROM users WHERE nip = ?',
      [nip]
    );

    if (rows.length === 0) {
      return {
        success: false,
        message: 'Invalid credentials'
      };
    }

    const user = rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return {
        success: false,
        message: 'Invalid credentials'
      };
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = this.generateToken(user);
    const userData = this.mapRowToUser(user);

    return {
      success: true,
      message: 'Login successful',
      data: { user: userData, token }
    };
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const { nip, name, email, password, role, staffAccessType } = credentials;

    const [existingRows] = await pool.query<UserRow[]>(
      'SELECT id FROM users WHERE nip = ? OR email = ?',
      [nip, email]
    );

    if (existingRows.length > 0) {
      return {
        success: false,
        message: 'User with this NIP or email already exists'
      };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (nip, name, email, password, role, staff_access_type) VALUES (?, ?, ?, ?, ?, ?)',
      [nip, name, email, hashedPassword, role || 'user', staffAccessType || null]
    );

    const [newUserRows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const newUser = newUserRows[0];

    return {
      success: true,
      message: 'Registration successful',
      data: {
        user: this.mapRowToUser(newUser),
        token: ''
      }
    };
  }

  async verifyNip(nip: string): Promise<AuthResponse> {
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at, last_login, uml_access FROM users WHERE nip = ?',
      [nip]
    );

    if (rows.length === 0) {
      return { success: false, message: 'NIP tidak ditemukan' };
    }

    const user = rows[0];

    return {
      success: true,
      message: 'NIP terverifikasi',
      data: {
        user: this.mapRowToUser(user),
        token: ''
      }
    };
  }

  async resetPassword(userId: number, newPassword: string): Promise<AuthResponse> {
    const [rows] = await pool.query<UserRow[]>('SELECT id FROM users WHERE id = ?', [userId]);

    if (rows.length === 0) {
      return { success: false, message: 'Pengguna tidak ditemukan' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, userId]);

    return { success: true, message: 'Password berhasil diubah' };
  }

  async getProfile(userId: number): Promise<AuthResponse> {
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at, last_login, uml_access FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return { success: false, message: 'User not found' };
    }

    const user = rows[0];

    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: this.mapRowToUser(user),
        token: ''
      }
    };
  }

  async updateProfile(userId: number, payload: ProfileUpdatePayload, photoPath?: string): Promise<AuthResponse> {
    const fields: string[] = [];
    const values: any[] = [];

    if (payload.name !== undefined) {
      fields.push('name = ?');
      values.push(payload.name);
    }

    if (payload.email !== undefined) {
      fields.push('email = ?');
      values.push(payload.email);
    }

    if (payload.nip !== undefined) {
      fields.push('nip = ?');
      values.push(payload.nip);
    }

    if (payload.gender !== undefined) {
      fields.push('gender = ?');
      values.push(payload.gender);
    }

    if (payload.workUnit !== undefined) {
      fields.push('work_unit = ?');
      values.push(payload.workUnit);
    }

    if (payload.homeAddress !== undefined) {
      fields.push('home_address = ?');
      values.push(payload.homeAddress);
    }

    if (photoPath) {
      fields.push('photo_path = ?');
      values.push(photoPath);
    }

    if (fields.length === 0) {
      return { success: false, message: 'Tidak ada perubahan data' };
    }

    fields.push('updated_at = NOW()');
    values.push(userId);

    try {
      await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, message: 'NIP atau email sudah digunakan' };
      }
      return { success: false, message: 'Gagal memperbarui profil' };
    }

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at, last_login, uml_access FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Pengguna tidak ditemukan' };
    }

    const updatedUser = this.mapRowToUser(rows[0]);

    return {
      success: true,
      message: 'Profil berhasil diperbarui',
      data: {
        user: updatedUser,
        token: ''
      }
    };
  }

  private generateToken(user: UserRow): string {
    const payload = {
      id: user.id,
      nip: user.nip,
      name: user.name,
      email: user.email,
      role: user.role,
      staffAccessType: user.staff_access_type,
      gender: user.gender,
      workUnit: user.work_unit,
      homeAddress: user.home_address,
      photoPath: user.photo_path
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', {
      expiresIn: '24h'
    });
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    } catch {
      return null;
    }
  }
}

export default new AuthService();
