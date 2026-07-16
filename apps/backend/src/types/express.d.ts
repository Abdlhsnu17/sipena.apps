import { User } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestId?: string;
      streamUserId?: number;
    }
  }
}

export {};
