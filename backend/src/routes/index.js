import express from 'express';
import userRoutes from './userRoutes.js';
import transcribeRoutes from './transcribeRoutes.js';

import connectionRoutes from './connectionRoutes.js';
import overshootRoutes from './overshootRoutes.js';
const router = express.Router();

router.use('/users', userRoutes);
router.use('/transcribe', transcribeRoutes);
router.use('/connections', connectionRoutes);
router.use('/', overshootRoutes);

router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to NexHacks API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      transcribe: '/api/transcribe',
      connections: '/api/connections',
      overshoot: '/api/overshoot-result',
      headshot: '/api/generate-headshot',
      health: '/health'
    }
  });
});

export default router;

