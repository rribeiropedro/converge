import express from 'express';
import { getAnalytics, getRecommendations } from '../controllers/analyticsController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// All analytics routes require authentication
router.use(auth);

// GET /api/analytics/network - Get network analytics data
router.get('/network', getAnalytics);

// POST /api/analytics/recommendations - Generate AI recommendations
router.post('/recommendations', getRecommendations);

export default router;
