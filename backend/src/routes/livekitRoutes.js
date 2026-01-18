import express from 'express';
import { AccessToken } from 'livekit-server-sdk';
import auth from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/livekit/token
 * Generate a LiveKit access token for a user to join a room
 * Requires authentication - userId is embedded in participant metadata
 */
router.post('/token', auth, async (req, res) => {
  try {
    const { roomName, participantName } = req.body;
    const userId = req.user._id.toString(); // Get from authenticated user

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({
        error: 'LiveKit credentials not configured. Please set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in your .env file.'
      });
    }

    // Use userId in identity for tracking
    const identity = `user-${userId}`;
    const room = roomName || `room-${userId}-${Date.now()}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName || req.user.email,
      // Store userId in metadata so agent can access it
      metadata: JSON.stringify({ 
        userId: userId,
        email: req.user.email 
      }),
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    res.json({
      token,
      url: process.env.LIVEKIT_URL,
      roomName: room,
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ 
      error: 'Failed to generate token',
      message: error.message 
    });
  }
});

export default router;

