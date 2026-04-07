import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/uml - Retrieve UML diagrams documentation
// Accessible to: admin, leader, staff, staff_pj, teknisi, user
router.get('/', 
  authMiddleware,
  requireRole(['admin', 'leader', 'staff', 'staff_pj', 'teknisi', 'user']),
  (req, res) => {
    res.json({
      success: true,
      message: 'UML documentation accessed',
      data: {
        diagrams: {
          useCase: {
            available: true,
            roles: ['admin', 'leader', 'staff', 'staff_pj', 'teknisi', 'user'],
            description: 'Use Case Diagram - Interaksi pengguna dengan sistem'
          },
          activity: {
            available: true,
            roles: ['admin', 'leader', 'staff', 'staff_pj', 'teknisi', 'user'],
            description: 'Activity Diagram - Alur proses dalam sistem'
          },
          classdiagram: {
            available: true,
            roles: ['admin'],
            description: 'Class Diagram - Struktur kelas dan entitas'
          },
          erd: {
            available: true,
            roles: ['admin'],
            description: 'Entity Relationship Diagram - Struktur database'
          }
        },
        uploads: {
          available: true,
          roles: ['admin', 'leader', 'staff', 'staff_pj', 'teknisi', 'user'],
          description: 'Unggahan - Upload dokumentasi dan laporan'
        },
        user: {
          role: req.user?.role,
          accessibleDiagrams: ['useCase', 'activity', 'uploads']
        }
      }
    });
  }
);

// POST /api/uml/access - Request UML access
// Accessible to: all authenticated users
router.post('/access', 
  authMiddleware,
  (req, res) => {
    res.json({
      success: true,
      message: 'UML access request recorded',
      data: {
        userId: req.user?.id,
        requestedAt: new Date(),
        status: 'pending',
        ...req.body
      }
    });
  }
);

export default router;
