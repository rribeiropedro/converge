import { generateTextEmbedding } from './textEmbeddingService.js';
import { validateVisualData, validateFaceEmbedding } from './schemaValidator.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(prompt) {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

const VISUAL_EXTRACTION_PROMPT = `You are an AI assistant that extracts structured visual profile data for PERSON IDENTIFICATION.

Your goal is to create a description that uniquely identifies THIS SPECIFIC PERSON across multiple encounters, even if they change clothes.

PRIORITIZE these PERSISTENT PHYSICAL FEATURES (in order of importance):
1. FACE: Face shape (round, oval, square), facial hair (beard, mustache, clean-shaven), skin tone
2. HAIR: Color, length, style (curly, straight, bald, receding hairline), facial hair
3. GLASSES: Whether they wear glasses, frame style/color
4. HEIGHT/BUILD: Tall, short, average, slim, athletic, heavy-set
5. AGE RANGE: Approximate age (20s, 30s, 40s, etc.)
6. DISTINCTIVE MARKS: Tattoos, piercings, scars, birthmarks, unique features

SECONDARY (mention but don't rely on):
- Clothing style (formal, casual, tech) - general pattern only, not specific items
- Accessories that seem permanent (wedding ring, religious symbols)

DO NOT focus on:
- Specific clothing items (these change daily)
- Temporary accessories (conference badges, bags)

Return ONLY valid JSON in this exact format:
{
  "appearance": {
    "description": "Concise description focusing on PERSISTENT PHYSICAL FEATURES that uniquely identify this person. Example: 'Tall man, early 30s, short brown hair, full beard, wears rectangular glasses, athletic build'",
    "distinctive_features": ["most unique identifying feature 1", "most unique identifying feature 2"]
  },
  "environment": {
    "description": "Natural language description of the location/setting",
    "landmarks": ["landmark1", "landmark2"]
  }
}

Remember: The appearance description will be combined with the person's NAME for identity matching. Focus on features that distinguish THIS person from others with similar names.`;

export async function parseVisualData(visualInput) {
  if (!visualInput) {
    throw new Error('Visual input is empty or invalid');
  }

  // Handle Overshoot SDK result format
  // Overshoot returns: { face_detected, appearance_profile, environment_context }
  // We need to convert to: { appearance: { description }, environment: { description } }
  let parsedVisual = visualInput;
  
  // Check if this is an Overshoot result (has appearance_profile or environment_context)
  if (visualInput.appearance_profile || visualInput.environment_context) {
    // Convert Overshoot format to our format
    parsedVisual = {
      ...visualInput,
      appearance: {
        description: visualInput.appearance_profile || '',
        distinctive_features: []
      },
      environment: {
        description: visualInput.environment_context || '',
        landmarks: []
      }
    };
  }
  
  // If we still don't have appearance/environment descriptions, use OpenRouter to extract
  if (!parsedVisual.appearance?.description || !parsedVisual.environment?.description) {
    const inputDescription = typeof visualInput === 'string' 
      ? visualInput 
      : JSON.stringify(visualInput);

    const responseText = await callOpenRouter(`${VISUAL_EXTRACTION_PROMPT}\n\nVISUAL DATA:\n${inputDescription}`);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }
    const openRouterParsed = JSON.parse(jsonMatch[0]);
    
    // Merge OpenRouter results with existing data
    parsedVisual = {
      ...parsedVisual,
      appearance: {
        description: openRouterParsed.appearance?.description || parsedVisual.appearance?.description || '',
        distinctive_features: openRouterParsed.appearance?.distinctive_features || parsedVisual.appearance?.distinctive_features || []
      },
      environment: {
        description: openRouterParsed.environment?.description || parsedVisual.environment?.description || '',
        landmarks: openRouterParsed.environment?.landmarks || parsedVisual.environment?.landmarks || []
      }
    };
  }

  // Merge input with parsed visual data
  const mergedVisual = { ...visualInput, ...parsedVisual };
  
  // Validate with Zod schema (ensures alignment with MongoDB schema)
  const validatedVisual = validateVisualData(mergedVisual);
  
  // Normalize to ensure proper structure
  const normalizedVisual = normalizeVisualData(validatedVisual);

  // Generate appearance embedding from appearance description (for text-based matching)
  if (
    normalizedVisual.appearance?.description &&
    (!normalizedVisual.appearance_embedding || normalizedVisual.appearance_embedding.length === 0)
  ) {
    try {
      const appearanceText = normalizedVisual.appearance.description;
      normalizedVisual.appearance_embedding = await generateTextEmbedding(appearanceText);

      console.log('Generated 1536-dim appearance embedding from description.');
    } catch (error) {
      console.warn('Failed to generate appearance embedding:', error.message);
      normalizedVisual.appearance_embedding = [];
    }
  }

  return normalizedVisual;
}

export function normalizeVisualData(visualData) {
  return {
    face_embedding: visualData.face_embedding || [],  // Deprecated, kept for migration
    appearance_embedding: visualData.appearance_embedding || [],  // 1536-dim text embedding
    appearance: {
      description: visualData.appearance?.description || '',
      distinctive_features: Array.isArray(visualData.appearance?.distinctive_features)
        ? visualData.appearance.distinctive_features
        : [],
    },
    environment: {
      description: visualData.environment?.description || '',
      landmarks: Array.isArray(visualData.environment?.landmarks)
        ? visualData.environment.landmarks
        : [],
    },
    headshot: {
      url: visualData.headshot?.url || null,
      base64: visualData.headshot?.base64 || null,
    },
  };
}

// validateFaceEmbedding is now imported from schemaValidator.js
// This function is kept for backward compatibility but uses Zod validation
export function validateFaceEmbeddingLocal(embedding) {
  return validateFaceEmbedding(embedding);
}
