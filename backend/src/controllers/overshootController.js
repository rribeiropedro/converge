/**
 * Controller for Overshoot SDK related endpoints
 */

/**
 * Receive and log Overshoot SDK results
 * @route POST /api/overshoot-result
 */
export const receiveOvershootResult = (req, res) => {
  const result = req.body;
  const timestamp = new Date().toLocaleTimeString();
  
  console.log('\n=== Overshoot Result ===');
  console.log(`[${timestamp}] Result text:`, result.result);
  console.log(`[${timestamp}] Inference latency:`, result.inference_latency_ms, 'ms');
  console.log(`[${timestamp}] Total latency:`, result.total_latency_ms, 'ms');
  console.log(`[${timestamp}] Full result:`, JSON.stringify(result, null, 2));
  console.log('========================\n');
  
  res.json({ status: 'received' });
};

/**
 * Generate headshot using OpenRouter (Gemini model)
 * @route POST /api/generate-headshot
 */
export const generateHeadshot = async (req, res) => {
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
    
    // Check if images array exists (OpenRouter format for image generation)
    if (Array.isArray(images) && images.length > 0) {
      const firstImage = images[0];
      let imageUrl = null;
      
      // Handle OpenRouter's standard format: { type: "image_url", image_url: { url: "..." } }
      if (firstImage.type === 'image_url' && firstImage.image_url?.url) {
        imageUrl = firstImage.image_url.url;
      }
      // Fallback: handle if it's just { url: "..." }
      else if (firstImage.url) {
        imageUrl = firstImage.url;
      }
      // Fallback: handle if it's a string (base64)
      else if (typeof firstImage === 'string') {
        imageUrl = firstImage.startsWith('data:') ? firstImage : `data:image/png;base64,${firstImage}`;
      }
      // Fallback: handle if it's { data: "base64..." }
      else if (firstImage.data) {
        imageUrl = `data:image/png;base64,${firstImage.data}`;
      }
      
      if (imageUrl) {
        console.log('Successfully extracted image URL from OpenRouter response');
        return res.json({ 
          success: true, 
          image: imageUrl,
          text: typeof content === 'string' ? content : ''
        });
      } else {
        console.error('Could not extract image URL from images array:', JSON.stringify(firstImage));
      }
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
    console.error('Images array:', images);
    return res.status(500).json({ 
      error: 'Unexpected response format from OpenRouter API',
      response: result,
      contentType: typeof content,
      contentPreview: typeof content === 'string' ? content.substring(0, 200) : JSON.stringify(content).substring(0, 200),
      imagesArray: images
    });

  } catch (error) {
    console.error('Error generating headshot:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
};

