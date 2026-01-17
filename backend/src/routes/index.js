import express from 'express';
import userRoutes from './userRoutes.js';

const router = express.Router();

// Mount route modules
router.use('/users', userRoutes);

// API info route
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Converge API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      health: '/health'
    }
  });
});

export default router;

