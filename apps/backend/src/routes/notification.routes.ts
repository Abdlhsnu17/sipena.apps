import { Router } from 'express';
import notificationController, { notificationValidators } from '../controllers/notification.controller';
import { requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', notificationValidators.getMine, notificationController.getMine);

router.post(
  '/broadcast',
  requireRole(['admin']),
  notificationValidators.broadcast,
  notificationController.broadcast
);
router.get('/delivery-status', notificationController.getDeliveryStatus);
router.post('/stream-ticket', notificationController.createStreamTicket);

router.get('/unread-count', notificationController.getUnreadCount);

router.patch('/read-all', notificationController.markAllAsRead);

router.patch('/:id/read', notificationValidators.id, notificationController.markAsRead);

router.delete('/:id', notificationValidators.id, notificationController.remove);

export default router;
