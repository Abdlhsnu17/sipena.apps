import { UserActivityController } from '../controllers/user_activity.controller';
import userActivityService from '../services/user_activity.service';

jest.mock('../services/user_activity.service', () => ({
  __esModule: true,
  default: {
    getActivities: jest.fn(),
    getByUserId: jest.fn(),
  },
}));

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe('UserActivityController', () => {
  const service = userActivityService as jest.Mocked<typeof userActivityService>;
  let controller: UserActivityController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UserActivityController();
  });

  it('returns 401 when listing activities without authenticated user', async () => {
    const req = { query: {} };
    const res = createResponse();

    await controller.getActivities(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Authentication required',
    });
    expect(service.getActivities).not.toHaveBeenCalled();
  });

  it('passes archive filters and actor context to the service', async () => {
    service.getActivities.mockResolvedValue({
      success: true,
      message: 'ok',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const req = {
      user: { id: 12, role: 'leader' },
      query: {
        userId: '9',
        page: '2',
        limit: '10',
        startDate: '2026-06-01',
        endDate: '2026-06-17',
      },
    };
    const res = createResponse();

    await controller.getActivities(req as any, res as any);

    expect(service.getActivities).toHaveBeenCalledWith({
      actorUserId: 12,
      actorRole: 'leader',
      userId: '9',
      page: '2',
      limit: '10',
      startDate: '2026-06-01',
      endDate: '2026-06-17',
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 when the activity service throws', async () => {
    service.getByUserId.mockRejectedValue(new Error('database down'));
    const req = { user: { id: 12, role: 'user' }, query: { limit: '5' } };
    const res = createResponse();

    await controller.getMyActivities(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
    });
  });
});
