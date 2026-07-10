import { Router } from 'express';
import notificationController, { notificationValidators } from '../controllers/notification.controller';

const router = Router();

router.get('/', notificationValidators.getMine, notificationController.getMine);
router.get('/delivery-status', notificationController.getDeliveryStatus);

router.get('/unread-count', notificationController.getUnreadCount);

router.patch('/read-all', notificationController.markAllAsRead);

router.patch('/:id/read', notificationValidators.id, notificationController.markAsRead);

router.delete('/:id', notificationValidators.id, notificationController.remove);

export default router;
