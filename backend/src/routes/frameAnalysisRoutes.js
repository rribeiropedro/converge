/**
 * Frame Analysis Routes - Fallback for when Overshoot SDK doesn't work
 * Uses OpenRouter Vision API (Claude/GPT-4V) to analyze video frames
 */

import express from 'express';

const router = express.Router();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * POST /api/analyze-frame
 * Analyzes a video frame for face detection and appearance extraction
 *
 * Body: { frame: "data:image/jpeg;base64,..." }
 * Returns: { face_detected, appearance_profile, environment_context }
 */
router.post('/analyze-frame', async (req, res) => {
  try {
    const { frame } = req.body;

    if (!frame || !frame.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid frame data' });
    }

    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPEN_ROUTER_API_KEY not configured' });
    }

    // Extract base64 data
    const base64Data = frame.includes(',') ? frame.split(',')[1] : frame;
    const mimeType = frame.match(/data:([^;]+)/)?.[1] || 'image/jpeg';

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:3000',
        'X-Title': 'Converge Frame Analysis'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`
                }
              },
              {
                type: 'text',
                text: `Analyze this image and respond with ONLY a JSON object (no markdown, no explanation):
{
  "face_detected": true/false,
  "appearance_profile": "Brief description of the person's appearance if face detected, otherwise empty string",
  "environment_context": "Brief description of the environment/setting if face detected, otherwise empty string"
}

Focus on PERSISTENT physical features for appearance_profile:
- Face shape, facial hair, skin tone
- Hair color, length, style
- Glasses (if any)
- Approximate age range
- Distinctive marks

Keep descriptions concise (under 50 words each).`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FrameAnalysis] OpenRouter error:', errorText);
      return res.status(response.status).json({
        error: 'Vision API error',
        details: errorText
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let parsed;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('[FrameAnalysis] Failed to parse response:', content);
      // Return default values if parsing fails
      parsed = {
        face_detected: false,
        appearance_profile: '',
        environment_context: ''
      };
    }

    // Ensure all required fields exist
    const finalResult = {
      face_detected: Boolean(parsed.face_detected),
      appearance_profile: parsed.appearance_profile || '',
      environment_context: parsed.environment_context || ''
    };

    console.log('[FrameAnalysis] Result:', finalResult);
    return res.json(finalResult);

  } catch (error) {
    console.error('[FrameAnalysis] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
