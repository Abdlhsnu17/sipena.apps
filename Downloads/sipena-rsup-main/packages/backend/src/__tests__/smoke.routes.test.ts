import express from 'express';
import request from 'supertest';

import { authMiddleware } from '../middlewares/authMiddleware';
import authRoutes from '../routes/auth.routes';
import borrowingRoutes from '../routes/borrowing.routes';
import maintenanceRoutes from '../routes/maintenance.routes';

describe('Backend smoke routes', () => {
  const app = express();

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-test-secret';

    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/borrowing', authMiddleware, borrowingRoutes);
    app.use('/api/maintenance', authMiddleware, maintenanceRoutes);
  });

  it('auth login returns 400 for invalid payload', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('borrowing main endpoint is protected', async () => {
    const response = await request(app).get('/api/borrowing');

    expect(response.status).toBe(401);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('maintenance main endpoint is protected', async () => {
    const response = await request(app).get('/api/maintenance');

    expect(response.status).toBe(401);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
  });
});
