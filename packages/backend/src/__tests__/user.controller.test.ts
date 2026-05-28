import { UserController } from '../controllers/user.controller';

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe('UserController RBAC hardening', () => {
  let controller: UserController;
  let userService: {
    getById: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    resetPassword: jest.Mock;
  };

  beforeEach(() => {
    controller = new UserController();
    userService = {
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      resetPassword: jest.fn(),
    };
    (controller as any).userService = userService;
  });

  it('blocks a leader from updating an admin user', async () => {
    userService.getById.mockResolvedValue({
      success: true,
      data: { id: 1, role: 'admin' },
    });
    const req = {
      user: { id: 2, role: 'leader' },
      params: { id: '1' },
      body: { name: 'Changed' },
    } as any;
    const res = createResponse();

    await controller.update(req, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Leader tidak dapat mengubah pengguna admin atau leader',
      })
    );
    expect(userService.update).not.toHaveBeenCalled();
  });

  it('blocks deleting the current authenticated account', async () => {
    const req = {
      user: { id: 7, role: 'admin' },
      params: { id: '7' },
    } as any;
    const res = createResponse();

    await controller.delete(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Tidak bisa menghapus akun sendiri',
      })
    );
    expect(userService.delete).not.toHaveBeenCalled();
  });

  it('blocks a leader from resetting an admin password', async () => {
    userService.getById.mockResolvedValue({
      success: true,
      data: { id: 1, role: 'admin' },
    });
    const req = {
      user: { id: 2, role: 'leader' },
      params: { id: '1' },
      body: { newPassword: 'secret123' },
    } as any;
    const res = createResponse();

    await controller.resetPassword(req, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Leader tidak dapat reset password admin atau leader',
      })
    );
    expect(userService.resetPassword).not.toHaveBeenCalled();
  });
});
