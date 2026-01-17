require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the React app build directory (in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Overshoot server is running' });
});

// Endpoint to receive Overshoot results
app.post('/api/overshoot-result', (req, res) => {
  const result = req.body;
  const timestamp = new Date().toLocaleTimeString();
  
  console.log('\n=== Overshoot Result ===');
  console.log(`[${timestamp}] Result text:`, result.result);
  console.log(`[${timestamp}] Inference latency:`, result.inference_latency_ms, 'ms');
  console.log(`[${timestamp}] Total latency:`, result.total_latency_ms, 'ms');
  console.log(`[${timestamp}] Full result:`, JSON.stringify(result, null, 2));
  console.log('========================\n');
  
  res.json({ status: 'received' });
});

// Endpoint to generate headshot using OpenRouter (Gemini model)
app.post('/api/generate-headshot', async (req, res) => {
  try {
    const { screenshots } = req.body; // Array of base64-encoded images
    
    if (!screenshots || !Array.isArray(screenshots) || screenshots.length !== 2) {
      return res.status(400).json({ error: 'Exactly 2 screenshots are required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY is not set in environment variables');
      return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
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

    // The prompt from the user's example
    const prompt = (
      "A professional, high-resolution headshot of the person in the reference photo. " +
      "The face is centered in the frame, facing directly forward (head-on) " +
      "with a neutral, professional expression. Use soft, even studio lighting " +
      "to ensure no harsh shadows. The background is a clean, solid neutral grey. " +
      "Shot on a 85mm lens for natural facial proportions, sharp focus on the eyes, " +
      "and a high-end cinematic quality."
    );

    // Prepare the request payload for OpenRouter (OpenAI-compatible format)
    const requestBody = {
      model: 'google/gemini-2.5-flash-image',
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
    // Note: OpenRouter requires the API key in the Authorization header as Bearer token
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': 'http://localhost:3000', // Optional: for tracking
          'X-Title': 'Overshoot Vision App' // Optional: for tracking
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return res.status(response.status).json({ 
        error: 'OpenRouter API request failed', 
        details: errorText 
      });
    }

    const result = await response.json();
    
    // Debug: Log the response structure to understand the format
    console.log('OpenRouter API response structure:', JSON.stringify(result, null, 2).substring(0, 500));
    
    // Extract the generated image if available
    // OpenRouter returns responses in OpenAI format
    const message = result.choices?.[0]?.message;
    const content = message?.content;
    
    // Handle different response formats
    if (!message) {
      console.error('No message in response:', result);
      return res.status(500).json({ 
        error: 'No message in OpenRouter response',
        response: result
      });
    }
    
    // Check if content is an array (multimodal response)
    if (Array.isArray(content)) {
      const imagePart = content.find(part => part.type === 'image_url' || part.type === 'image');
      const textPart = content.find(part => part.type === 'text');
      
      if (imagePart) {
        const imageUrl = imagePart.image_url?.url || imagePart.url;
        if (imageUrl) {
          return res.json({ 
            success: true, 
            image: imageUrl,
            text: textPart?.text || ''
          });
        }
      }
      
      // If no image but has text
      if (textPart) {
        return res.json({ 
          success: true, 
          text: textPart.text,
          note: 'Model returned text instead of image. Image generation may require a different model or the model may not support image output.'
        });
      }
    }
    
    // Check if content is a string (text-only response)
    if (typeof content === 'string') {
      // Check if string contains an image data URL
      if (content.includes('data:image')) {
        const imageMatch = content.match(/data:image\/[^;]+;base64,[^\s"']+/);
        if (imageMatch) {
          return res.json({ 
            success: true, 
            image: imageMatch[0],
            text: content
          });
        }
      }
      
      // Otherwise it's just text
      return res.json({ 
        success: true, 
        text: content,
        note: 'Model returned text instead of image. Image generation may require a different model or the model may not support image output.'
      });
    }
    
    // If we get here, the format is unexpected
    console.error('Unexpected content format:', typeof content, content);
    return res.status(500).json({ 
      error: 'Unexpected response format from OpenRouter API',
      response: result,
      contentType: typeof content,
      contentPreview: typeof content === 'string' ? content.substring(0, 200) : JSON.stringify(content).substring(0, 200)
    });

  } catch (error) {
    console.error('Error generating headshot:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Serve React app (in production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

