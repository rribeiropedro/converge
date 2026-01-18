import express from 'express';
import { AccessToken } from 'livekit-server-sdk';

const router = express.Router();

/**
 * POST /api/livekit/token
 * Generate a LiveKit access token for a user to join a room
 */
router.post('/token', async (req, res) => {
  try {
    const { roomName, participantName, agentName } = req.body;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({
        error: 'LiveKit credentials not configured. Please set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in your .env file.'
      });
    }

    const identity = participantName || `user-${Date.now()}`;
    const room = roomName || `room-${Date.now()}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName || 'User',
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

