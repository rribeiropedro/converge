import Anthropic from '@anthropic-ai/sdk';
import { generateFaceEmbedding } from './faceEmbeddingService.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const VISUAL_EXTRACTION_PROMPT = `You are an AI assistant that extracts structured visual profile data from video/image analysis.

Analyze the following visual data from a networking conversation and extract:
1. Appearance description (clothing, hair, distinguishing features)
2. Distinctive features that would help identify this person later
3. Environment description (where the conversation took place)
4. Landmarks or notable items in the environment

Return ONLY valid JSON in this exact format:
{
  "appearance": {
    "description": "Natural language description of how the person looks",
    "distinctive_features": ["feature1", "feature2"]
  },
  "environment": {
    "description": "Natural language description of the location/setting",
    "landmarks": ["landmark1", "landmark2"]
  }
}

Be specific and memorable - focus on details that would help someone recognize this person or remember where they met.`;

export async function parseVisualData(visualInput) {
  if (!visualInput) {
    throw new Error('Visual input is empty or invalid');
  }

  let parsedVisual = visualInput;
  
  if (!visualInput.appearance?.description || !visualInput.environment?.description) {
    const inputDescription = typeof visualInput === 'string' 
      ? visualInput 
      : JSON.stringify(visualInput);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${VISUAL_EXTRACTION_PROMPT}\n\nVISUAL DATA:\n${inputDescription}`,
        },
      ],
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }
    parsedVisual = JSON.parse(jsonMatch[0]);
  }

  const normalizedVisual = normalizeVisualData({ ...visualInput, ...parsedVisual });

  if (
    normalizedVisual.headshot &&
    (normalizedVisual.headshot.url || normalizedVisual.headshot.base64) &&
    (!normalizedVisual.face_embedding || normalizedVisual.face_embedding.length === 0)
  ) {
    try {
      const imageData = normalizedVisual.headshot.base64 || normalizedVisual.headshot.url;
      normalizedVisual.face_embedding = await generateFaceEmbedding(imageData);
      console.log('Generated 128-dim face embedding for headshot.');
    } catch (error) {
      console.warn('Failed to generate face embedding from headshot:', error.message);
      normalizedVisual.face_embedding = [];
    }
  }

  return normalizedVisual;
}

export function normalizeVisualData(visualData) {
  return {
    face_embedding: visualData.face_embedding || [],
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

export function validateFaceEmbedding(embedding) {
  if (!Array.isArray(embedding)) return false;
  if (embedding.length !== 128) return false;
  return embedding.every(val => typeof val === 'number');
}
