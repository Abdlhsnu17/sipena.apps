import { Router } from 'express';

const router = Router();

// Mock uml routes - untuk development
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'UML route working',
    data: []
  });
});

router.post('/access', (req, res) => {
  res.json({
    success: true,
    message: 'UML access request created',
    data: req.body
  });
});

export default router;
