import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import accessControlRoutes from '../routes/access_control.routes';
import assetRoutes from '../routes/asset.routes';
import sanctionsRoutes from '../routes/sanctions.routes';

const attachUser = (role: string) => (req: Request, _res: Response, next: NextFunction): void => {
  req.user = {
    id: 99,
    nip: '199901012026011001',
    name: 'Test User',
    email: 'test@example.test',
    role,
    createdAt: new Date(),
  };
  next();
};

describe('Permission route guards', () => {
  it('blocks non-admin users from resetting all inventory data', async () => {
    const app = express();
    app.use(express.json());
    app.use(attachUser('leader'));
    app.use('/api/assets', assetRoutes);

    const response = await request(app).delete('/api/assets/reset/all');

    expect(response.status).toBe(403);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      message: 'Insufficient permissions',
    }));
  });

  it('blocks non-admin users from reading access-control matrix', async () => {
    const app = express();
    app.use(express.json());
    app.use(attachUser('leader'));
    app.use('/api/access-control', accessControlRoutes);

    const response = await request(app).get('/api/access-control/matrix');

    expect(response.status).toBe(403);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      message: 'Insufficient permissions',
    }));
  });

  it('blocks regular users from managing sanctions', async () => {
    const app = express();
    app.use(express.json());
    app.use(attachUser('user'));
    app.use('/api/sanctions', sanctionsRoutes);

    const response = await request(app).get('/api/sanctions/stats');

    expect(response.status).toBe(403);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      message: 'Insufficient permissions',
    }));
  });
});
