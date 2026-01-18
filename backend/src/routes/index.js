import express from 'express';
import userRoutes from './userRoutes.js';
import transcribeRoutes from './transcribeRoutes.js';

import connectionRoutes from './connectionRoutes.js';
import overshootRoutes from './overshootRoutes.js';
import livekitRoutes from './livekitRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import frameAnalysisRoutes from './frameAnalysisRoutes.js';
const router = express.Router();

router.use('/users', userRoutes);
router.use('/transcribe', transcribeRoutes);
router.use('/connections', connectionRoutes);
router.use('/livekit', livekitRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/', overshootRoutes);
router.use('/', frameAnalysisRoutes); // Fallback vision analysis

router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to NexHacks API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      transcribe: '/api/transcribe',
      connections: '/api/connections',
      analytics: '/api/analytics',
      overshoot: '/api/overshoot-result',
      headshot: '/api/generate-headshot',
      analyzeFrame: '/api/analyze-frame',
      livekit: '/api/livekit/token',
      health: '/health'
    }
  });
});

export default router;

