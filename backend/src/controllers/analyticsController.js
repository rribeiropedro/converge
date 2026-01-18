import { getNetworkAnalytics, generateNetworkRecommendations } from '../services/networkAnalyticsService.js';

/**
 * Get network analytics data for the authenticated user
 * GET /api/analytics/network
 */
export async function getAnalytics(req, res) {
  try {
    const userId = req.user._id;
    const analytics = await getNetworkAnalytics(userId);
    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching network analytics:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch network analytics' });
  }
}

/**
 * Generate AI-powered network recommendations
 * POST /api/analytics/recommendations
 */
export async function getRecommendations(req, res) {
  try {
    const userId = req.user._id;
    const recommendations = await generateNetworkRecommendations(userId);
    res.status(200).json(recommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: error.message || 'Failed to generate recommendations' });
  }
}
