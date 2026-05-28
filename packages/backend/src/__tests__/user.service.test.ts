import bcrypt from 'bcryptjs';
import pool from '../config/database';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('UserService password reset', () => {
  const mockedQuery = pool.query as jest.Mock;
  let service: UserService;

  beforeEach(() => {
    mockedQuery.mockReset();
    service = new UserService();
  });

  it('resets a user password, invalidates sessions, and forces password change', async () => {
    mockedQuery
      .mockResolvedValueOnce([[{ id: 9 }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await service.resetPassword('9', 'new-secret');

    expect(result).toEqual({
      success: true,
      message: 'Password pengguna berhasil direset',
    });
    expect(mockedQuery).toHaveBeenCalledTimes(2);

    const [updateSql, updateParams] = mockedQuery.mock.calls[1];
    expect(updateSql).toContain('must_change_password = 1');
    expect(updateSql).toContain('session_version = session_version + 1');
    expect(await bcrypt.compare('new-secret', updateParams[0])).toBe(true);
    expect(updateParams[1]).toBe('9');
  });

  it('returns not found when resetting a missing user', async () => {
    mockedQuery.mockResolvedValueOnce([[], []]);

    const result = await service.resetPassword('99', 'new-secret');

    expect(result).toEqual({
      success: false,
      message: 'User not found',
    });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService account status checks', () => {
  const mockedQuery = pool.query as jest.Mock;
  let service: AuthService;

  beforeEach(() => {
    mockedQuery.mockReset();
    service = new AuthService();
  });

  it('rejects login for inactive users before checking the password', async () => {
    mockedQuery.mockResolvedValueOnce([
      [
        {
          id: 4,
          nip: '200203172025211031',
          name: 'Inactive User',
          email: 'inactive@example.test',
          password: 'not-a-hash',
          role: 'user',
          staff_access_type: null,
          account_status: 'inactive',
          must_change_password: 0,
          session_version: 0,
          uml_access: 0,
        },
      ],
      [],
    ]);

    const result = await service.login({
      nip: '200203172025211031',
      password: 'wrong-or-right',
    });

    expect(result).toEqual({
      success: false,
      message: 'Akun Anda sedang nonaktif. Hubungi admin.',
    });
  });
});
