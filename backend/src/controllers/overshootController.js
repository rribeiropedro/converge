/**
 * Controller for Overshoot SDK related endpoints
 */

import { findMatchingConnection, addAppearanceEmbedding } from '../services/faceMatching.js';
import SessionManager from '../realtime/SessionManager.js';
import { getSocketBySessionId } from '../realtime/sessionSocket.js';
import * as logger from '../utils/sessionLogger.js';

/**
 * Receive and log Overshoot SDK results
 * @route POST /api/overshoot-result
 */
export const receiveOvershootResult = (req, res) => {
  const result = req.body;
  const timestamp = new Date().toLocaleTimeString();
  
  // Parse result to check for face detection
  let parsedResult = null;
  try {
    parsedResult = typeof result.result === 'string' 
      ? JSON.parse(result.result) 
      : result.result;
  } catch (e) {
    // Not JSON, that's okay
  }
  
  const faceDetected = parsedResult?.face_detected === true;
  
  console.log('\n=== Overshoot Result ===');
  console.log(`[${timestamp}] Face Detected: ${faceDetected ? '✅ YES' : '❌ NO'}`);
  if (parsedResult) {
    console.log(`[${timestamp}] Appearance: ${parsedResult.appearance_profile || 'N/A'}`);
    console.log(`[${timestamp}] Environment: ${parsedResult.environment_context || 'N/A'}`);
  }
  console.log(`[${timestamp}] Inference latency:`, result.inference_latency_ms, 'ms');
  console.log(`[${timestamp}] Total latency:`, result.total_latency_ms, 'ms');
  console.log('========================\n');
  
  res.json({ status: 'received' });
};

/**
 * Generate headshot using OpenRouter (Gemini model)
 * @route POST /api/generate-headshot
 */
export const generateHeadshot = async (req, res) => {
  try {
    console.log('\n🔔 HEADSHOT GENERATION REQUEST RECEIVED');
    console.log('  Request body keys:', Object.keys(req.body));
    console.log('  Has screenshots:', !!req.body.screenshots);
    console.log('  Screenshot count:', req.body.screenshots?.length || 0);
    console.log('  Session ID:', req.body.sessionId || 'MISSING');
    
    const { screenshots, sessionId } = req.body; // Array of base64-encoded images + session ID
    
    if (!screenshots || !Array.isArray(screenshots) || screenshots.length !== 2) {
      console.error('❌ Invalid screenshots:', {
        isArray: Array.isArray(screenshots),
        length: screenshots?.length,
        type: typeof screenshots
      });
      return res.status(400).json({ error: 'Exactly 2 screenshots are required' });
    }

    if (!sessionId) {
      console.error('❌ Missing sessionId');
      return res.status(400).json({ error: 'sessionId is required' });
    }

    logger.logHeadshotGeneration(sessionId, 'started', {
      screenshotCount: screenshots.length
    });

    // Mark headshot as pending so session waits for it before finalizing
    SessionManager.markHeadshotPending(sessionId);

    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPEN_ROUTER_API_KEY is not set in environment variables');
      return res.status(500).json({ error: 'OPEN_ROUTER_API_KEY not configured' });
    }
    
    // Debug: Log that we have an API key (but don't log the actual key)
    console.log('OpenRouter API key found:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');

    // Prepare image content for OpenRouter (OpenAI-compatible format)
    const imageContents = screenshots.map((base64Image) => {
      // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Data = base64Image.includes(',') 
        ? base64Image.split(',')[1] 
        : base64Image;
      
      // Detect mime type from data URL or default to jpeg
      let mimeType = 'image/jpeg';
      if (base64Image.includes('data:image/')) {
        const match = base64Image.match(/data:image\/([^;]+)/);
        if (match) mimeType = `image/${match[1]}`;
      }
      
      return {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`
        }
      };
    });

    // The prompt for professional headshot generation
    const prompt = (
      "A professional, high-resolution headshot of the person in the reference photo. " +
      "The face is centered in the frame, facing directly forward (head-on) " +
      "with a neutral, professional expression. Use soft, even studio lighting " +
      "to ensure no harsh shadows. The background is a clean, solid neutral grey. " +
      "Shot on a 85mm lens for natural facial proportions, sharp focus on the eyes, " +
      "and a high-end cinematic quality."
    );

    // Prepare the request payload for OpenRouter (OpenAI-compatible format)
    // IMPORTANT: modalities: ["image", "text"] is required to enable image generation output
    // Without this, Gemini models only return text descriptions
    const requestBody = {
      model: 'bytedance-seed/seedream-4.5',
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    };

    // Call OpenRouter API
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': process.env.MOBILE_CLIENT_URL || 'http://localhost:3002',
          'X-Title': 'Converge Vision App'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      console.error('Request details:', {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        model: requestBody.model,
        apiKeyPrefix: apiKey ? `${apiKey.substring(0, 15)}...` : 'MISSING',
        statusCode: response.status
      });
      
      // More specific error messages based on status code
      let errorMessage = 'OpenRouter API request failed';
      if (response.status === 401) {
        errorMessage = 'Invalid or expired OpenRouter API key. Please check your OPENROUTER_API_KEY in .env file.';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded or insufficient credits on OpenRouter account.';
      } else if (response.status === 400) {
        errorMessage = 'Bad request to OpenRouter API. Check your request format.';
      }
      
      return res.status(response.status).json({ 
        error: errorMessage, 
        details: errorText,
        statusCode: response.status
      });
    }

    const result = await response.json();
    
    // Debug: Log the response structure (without full base64 to avoid truncation)
    const debugResult = {
      ...result,
      choices: result.choices?.map(choice => ({
        ...choice,
        message: choice.message ? {
          ...choice.message,
          images: choice.message.images?.map(img => {
            if (typeof img === 'string') {
              return `[string: ${img.length} chars, starts with: ${img.substring(0, 50)}...]`;
            }
            if (img.image_url?.url) {
              const url = img.image_url.url;
              return {
                ...img,
                image_url: {
                  ...img.image_url,
                  url: url.length > 100 ? `[${url.length} chars, starts with: ${url.substring(0, 50)}...]` : url
                }
              };
            }
            return img;
          })
        } : choice.message
      }))
    };
    console.log('OpenRouter API response structure:', JSON.stringify(debugResult, null, 2));
    
    // Specifically log the images array structure
    if (result.choices?.[0]?.message?.images) {
      const firstImage = result.choices[0].message.images[0];
      console.log('First image type:', typeof firstImage);
      console.log('First image keys:', firstImage ? Object.keys(firstImage) : 'null');
      if (firstImage && typeof firstImage === 'object') {
        console.log('First image structure:', {
          type: firstImage.type,
          hasImageUrl: !!firstImage.image_url,
          imageUrlType: firstImage.image_url ? typeof firstImage.image_url : 'none',
          imageUrlKeys: firstImage.image_url ? Object.keys(firstImage.image_url) : 'none',
          urlLength: firstImage.image_url?.url ? firstImage.image_url.url.length : 'none'
        });
      }
    }
    
    // Extract the generated image if available
    const message = result.choices?.[0]?.message;
    const content = message?.content;
    const images = message?.images;
    
    // Handle different response formats
    if (!message) {
      console.error('No message in response:', result);
      return res.status(500).json({ 
        error: 'No message in OpenRouter response',
        response: result
      });
    }
    
    // Extract image URL from various response formats
    let extractedImageUrl = null;
    let textContent = '';
    
    // Check if images array exists (OpenRouter format for image generation)
    if (Array.isArray(images) && images.length > 0) {
      const firstImage = images[0];
      
      // Handle OpenRouter's standard format: { type: "image_url", image_url: { url: "..." } }
      if (firstImage.type === 'image_url' && firstImage.image_url?.url) {
        extractedImageUrl = firstImage.image_url.url;
      }
      // Fallback: handle if it's just { url: "..." }
      else if (firstImage.url) {
        extractedImageUrl = firstImage.url;
      }
      // Fallback: handle if it's a string (base64)
      else if (typeof firstImage === 'string') {
        extractedImageUrl = firstImage.startsWith('data:') ? firstImage : `data:image/png;base64,${firstImage}`;
      }
      // Fallback: handle if it's { data: "base64..." }
      else if (firstImage.data) {
        extractedImageUrl = `data:image/png;base64,${firstImage.data}`;
      }
      
      textContent = typeof content === 'string' ? content : '';
      
      if (!extractedImageUrl) {
        console.error('Could not extract image URL from images array:', JSON.stringify(firstImage));
      }
    }
    
    // Check if content is an array (multimodal response)
    if (!extractedImageUrl && Array.isArray(content)) {
      const imagePart = content.find(part => part.type === 'image_url' || part.type === 'image');
      const textPart = content.find(part => part.type === 'text');
      
      if (imagePart) {
        extractedImageUrl = imagePart.image_url?.url || imagePart.url;
      }
      textContent = textPart?.text || '';
    }
    
    // Check if content is a string (text-only response)
    if (!extractedImageUrl && typeof content === 'string') {
      // Check if string contains an image data URL
      if (content.includes('data:image')) {
        const imageMatch = content.match(/data:image\/[^;]+;base64,[^\s"']+/);
        if (imageMatch) {
          extractedImageUrl = imageMatch[0];
        }
      }
      textContent = content;
    }
    
    // If we have an image, store it in session and perform face matching
    if (extractedImageUrl) {
      logger.logHeadshotGeneration(sessionId, 'success', {
        imageUrl: extractedImageUrl
      });

      // Store headshot in session visual data
      // IMPORTANT: Check if session still exists before updating
      const activeSessionIds = SessionManager.getActiveSessionIds();
      if (!activeSessionIds.includes(sessionId)) {
        console.log(`[Headshot] Session ${sessionId} already finalized, cannot store headshot`);
        // Session is gone, but we can still return the image to the client
        // The client will display it, even if it's not saved to MongoDB
        return res.json({
          success: true,
          image: extractedImageUrl,
          text: textContent,
          warning: 'Session already finalized - headshot not saved to database'
        });
      }

      try {
        SessionManager.updateVisual(sessionId, {
          headshot: {
            url: extractedImageUrl.startsWith('http') ? extractedImageUrl : null,
            base64: extractedImageUrl.startsWith('data:image') ? extractedImageUrl : null
          }
        });
        // Mark headshot as complete ONLY if update succeeded
        SessionManager.markHeadshotComplete(sessionId);
        console.log(`✅ Headshot stored in session ${sessionId}`);
      } catch (err) {
        logger.logError(sessionId, 'Storing headshot in session', err);
        // DO NOT mark complete if update failed - let the timeout handle it
        // This is critical: marking complete when update failed causes data loss
        console.log(`[Headshot] Session ${sessionId} update failed, NOT marking complete`);
      }
      
      // Perform face matching in the background (don't block the response)
      performFaceMatching(extractedImageUrl, sessionId).catch(err => {
        logger.logError(sessionId, 'Face matching (background)', err);
      });
      
      return res.json({ 
        success: true, 
        image: extractedImageUrl,
        text: textContent
      });
    }
    
    // No image found - return text-only response
    if (textContent) {
      return res.json({ 
        success: true, 
        text: textContent,
        note: 'Model returned text instead of image. Image generation may require a different model or the model may not support image output.'
      });
    }
    
    // If we get here, the format is unexpected
    logger.logHeadshotGeneration(sessionId, 'error', {
      error: 'Unexpected response format from OpenRouter API'
    });
    console.error('Unexpected content format:', typeof content, content);
    console.error('Images array:', images);
    return res.status(500).json({ 
      error: 'Unexpected response format from OpenRouter API',
      response: result,
      contentType: typeof content,
      contentPreview: typeof content === 'string' ? content.substring(0, 200) : JSON.stringify(content).substring(0, 200),
      imagesArray: images
    });

  } catch (error) {
    logger.logHeadshotGeneration(sessionId, 'error', {
      error: error.message
    });
    console.error('Error generating headshot:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
};

/**
 * Perform connection matching using appearance text embedding
 * @param {string} imageUrl - Base64 data URL of the generated headshot (for storage only)
 * @param {string} sessionId - Session ID to update with match results
 */
async function performFaceMatching(imageUrl, sessionId) {
  try {
    // Check if session still exists before attempting any operations
    const activeSessionIds = SessionManager.getActiveSessionIds();
    if (!activeSessionIds.includes(sessionId)) {
      console.log(`[Matching] Session ${sessionId} already finalized, skipping face matching`);
      return;
    }

    // Get session to retrieve userId and visual/audio data
    let session;
    try {
      session = SessionManager.getSession(sessionId);
    } catch (err) {
      console.error(`[Matching] Session ${sessionId} not found:`, err.message);
      return;
    }

    const userId = session.userId;
    const visualData = session.visual;
    const audioData = session.audio;

    // Get appearance description from Overshoot (already working)
    const appearanceDescription = visualData?.appearance?.description || '';
    // Get name from transcript parsing
    const name = audioData?.name || '';

    if (!appearanceDescription && !name) {
      console.log('⚠️ No appearance or name data available for matching');

      // Emit new contact result to client
      const socket = getSocketBySessionId(sessionId);
      if (socket) {
        socket.emit('face_match_result', {
          matched: false,
          name: 'New Contact',
          company: null,
          profileImage: null,
          insights: [
            { type: 'bullet', text: 'New person detected' },
            { type: 'bullet', text: 'No previous connection found' },
            { type: 'bullet', text: 'Ready to save new connection' }
          ]
        });
      }
      return;
    }

    logger.logFaceMatchingStarted(sessionId, true, 1536); // 1536-dim text embedding

    // Find matching connection using TEXT embedding
    const matches = await findMatchingConnection(userId, name, appearanceDescription);

    logger.logFaceMatchResult(
      sessionId,
      matches.length > 0 && matches[0].score >= 0.75,
      matches.length > 0 ? {
        name: matches[0].connection.name?.value || matches[0].connection.name || 'Unknown',
        connectionId: matches[0].connection._id.toString(),
        score: matches[0].score
      } : null,
      matches
    );

    // Prepare match result data for the UI overlay
    let matchResult;

    if (matches.length > 0 && matches[0].score >= 0.75) {
      // Best match found
      const bestMatch = matches[0];

      // Check if session still exists before updating
      if (!SessionManager.getActiveSessionIds().includes(sessionId)) {
        console.log(`[Matching] Session ${sessionId} finalized during matching, skipping update`);
        return;
      }

      // Update session with match results
      SessionManager.updateFaceMatch(sessionId, {
        matched: true,
        connectionId: bestMatch.connection._id.toString(),
        name: bestMatch.connection.name?.value || bestMatch.connection.name || 'Unknown',
        connectionData: {
          company: bestMatch.connection.company?.value || bestMatch.connection.company || null,
          visual: bestMatch.connection.visual,
          score: bestMatch.score
        }
      });

      // Build result for UI with real data
      const connectionName = bestMatch.connection.name?.value || bestMatch.connection.name || 'Unknown';
      const connectionCompany = bestMatch.connection.company?.value || bestMatch.connection.company || 'Unknown';
      matchResult = {
        matched: true,
        name: connectionName,
        company: connectionCompany,
        profileImage: bestMatch.connection.visual?.headshot?.url || null,
        insights: [
          { type: 'bullet', text: `Name: ${connectionName}` },
          { type: 'bullet', text: `Company: ${connectionCompany}` },
          { type: 'bullet', text: `Match confidence: ${Math.round(bestMatch.score * 100)}%` },
          { type: 'bullet', text: `Previous connection found` }
        ]
      };

      // Update the existing connection's appearance embedding
      try {
        await addAppearanceEmbedding(
          bestMatch.connection._id.toString(),
          name,
          appearanceDescription,
          { event: session.context?.event }
        );
      } catch (err) {
        console.warn('Failed to update appearance embedding:', err.message);
      }

    } else {
      // No match found - new person
      // Check if session still exists before updating
      if (!SessionManager.getActiveSessionIds().includes(sessionId)) {
        console.log(`[Matching] Session ${sessionId} finalized during matching, skipping update`);
        return;
      }

      SessionManager.updateFaceMatch(sessionId, {
        matched: false,
        connectionId: null,
        name: null,
        connectionData: null
      });

      matchResult = {
        matched: false,
        name: 'New Contact',
        company: null,
        profileImage: null,
        insights: [
          { type: 'bullet', text: 'New person detected' },
          { type: 'bullet', text: 'No previous connection found' },
          { type: 'bullet', text: 'Professional networking context' },
          { type: 'bullet', text: 'Ready to save new connection' }
        ]
      };
    }

    // Emit update to client via WebSocket
    const socket = getSocketBySessionId(sessionId);
    if (socket) {
      socket.emit('face_match_result', matchResult);
    } else {
      logger.logError(sessionId, 'Matching - socket not found', new Error('No socket found for session'));
    }

  } catch (error) {
    logger.logError(sessionId, 'Connection matching', error);
  }
}

