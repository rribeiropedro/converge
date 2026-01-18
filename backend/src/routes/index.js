import express from 'express';
import userRoutes from './userRoutes.js';
import transcribeRoutes from './transcribeRoutes.js';

const router = express.Router();

// Mount route modules
router.use('/users', userRoutes);
router.use('/transcribe', transcribeRoutes);

// API info route
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Converge API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      transcribe: '/api/transcribe',
      health: '/health'
    }
  });
});

export default router;

