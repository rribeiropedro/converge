import express from 'express';
import userRoutes from './userRoutes.js';
import connectionRoutes from './connectionRoutes.js';

const router = express.Router();

router.use('/users', userRoutes);
router.use('/connections', connectionRoutes);

router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to NexHacks API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      connections: '/api/connections',
      health: '/health'
    }
  });
});

export default router;

