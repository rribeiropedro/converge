import express from 'express';
import userRoutes from './userRoutes.js';
import overshootRoutes from './overshootRoutes.js';

const router = express.Router();

// Mount route modules
router.use('/users', userRoutes);
router.use('/', overshootRoutes);

// API info route
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Converge API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      overshoot: '/api/overshoot-result',
      headshot: '/api/generate-headshot',
      health: '/health'
    }
  });
});

export default router;

