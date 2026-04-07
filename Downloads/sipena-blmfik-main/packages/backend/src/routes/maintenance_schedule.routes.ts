import { Router } from 'express';
import * as scheduleController from '../controllers/maintenance_schedule.controller';
import { requireRole } from '../middlewares/authMiddleware';

const router = Router();
router.use(requireRole(['admin', 'leader', 'staff', 'staff_pj', 'staff pj', 'teknisi', 'tekniksi']));

// Create schedule - only admin, leader, staff, staff_pj
router.post('/', scheduleController.createSchedule);

// Get schedules - all authenticated users
router.get('/', scheduleController.getAllSchedules);
router.get('/:id', scheduleController.getScheduleById);

// Update schedule - teknisi can only update status, others can update all fields
router.put('/:id', scheduleController.updateSchedule);

// Update only status - teknisi, admin, leader
router.patch('/:id/status', scheduleController.updateScheduleStatus);

// Delete schedule - only admin, leader
router.delete('/:id', scheduleController.deleteSchedule);

export default router;
