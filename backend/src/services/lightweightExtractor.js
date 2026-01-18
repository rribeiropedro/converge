/**
 * Lightweight LLM-based real-time extraction
 * Uses fast, cheap models for instant profile extraction
 * 
 * Supported models:
 * - Gemini 2.0 Flash (fastest, cheapest) - ~200-400ms, $0.000019/1K tokens
 * - GPT-4o Mini (fast, reliable) - ~300-600ms, $0.00015/1K tokens
 * - Claude Haiku (balanced) - ~400-800ms, $0.00025/1K tokens
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model options (ordered by speed/cost)
const MODELS = {
  'gemini-flash': 'google/gemini-2.0-flash-exp:free', // FREE during preview!
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'claude-haiku': 'anthropic/claude-3-haiku'
};

// Default to Gemini Flash (fastest & free during preview)
const DEFAULT_MODEL = MODELS['gemini-flash'];

/**
 * Compact extraction prompt for lightweight models
 */
const EXTRACTION_PROMPT = `Extract profile info from this transcript. Return ONLY valid JSON:

{
  "name": "Full Name or null",
  "company": "Company Name or null", 
  "role": "Job Title or null",
  "institution": "School/University or null",
  "major": "Field of Study or null",
  "industry": "Industry/Sector or null",
  "topics": ["topic1", "topic2"],
  "challenges": ["challenge1"]
}

Rules:
- Only extract explicitly mentioned information
- Use null if not found
- Keep topics/challenges short
- Return ONLY the JSON, no other text

Transcript: `;

const tryMatch = (pattern, text) => {
  const match = text.match(pattern);
  return match && match[1] ? match[1].trim() : null;
};

const cleanPhrase = (value) => {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 2) return null;
  return cleaned;
};

const heuristicExtract = (transcript, existingProfile = {}) => {
  const updates = {};
  const topics = [];
  const challenges = [];

  const name = cleanPhrase(
    tryMatch(/\b(?:i am|i'm|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/, transcript)
  );
  if (name && !existingProfile.name?.value) {
    updates.name = { value: name, confidence: 'low' };
  }

  const company = cleanPhrase(
    tryMatch(/\b(?:at|with|from)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,2})/, transcript)
  );
  if (company && !existingProfile.company?.value) {
    updates.company = { value: company, confidence: 'low' };
  }

  const role = cleanPhrase(
    tryMatch(/\b(?:i am|i'm|i work as|my role is)\s+(?:an?\s+)?([A-Za-z][\w\s&-]{2,40})/i, transcript)
  );
  if (role && !existingProfile.role?.value) {
    updates.role = { value: role, confidence: 'low' };
  }

  const topic = cleanPhrase(
    tryMatch(/\b(?:working on|building|focusing on|interested in|exploring|looking for)\s+([^.,;]+)/i, transcript)
  );
  if (topic) topics.push(topic);

  const challenge = cleanPhrase(
    tryMatch(/\b(?:challenge|problem|issue|struggle)\s+(?:is|with)?\s*([^.,;]+)/i, transcript)
  );
  if (challenge) challenges.push(challenge);

  if (Object.keys(updates).length === 0 && topics.length === 0 && challenges.length === 0) {
    console.log('[LightweightExtractor] Heuristic extracted nothing');
    return {};
  }

  console.log('[LightweightExtractor] Heuristic extracted', {
    profile: Object.keys(updates).length,
    topics: topics.length,
    challenges: challenges.length
  });
  return {
    profile: updates,
    topics_discussed: topics,
    their_challenges: challenges,
    _latency: 0
  };
};

/**
 * Call lightweight LLM for extraction
 * @param {string} transcript - Transcript to analyze
 * @param {string} model - Model to use (default: gemini-flash)
 * @returns {Promise<object>} - Extracted data
 */
async function callLightweightLLM(transcript, model = DEFAULT_MODEL) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not found in environment variables');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.MOBILE_CLIENT_URL || 'http://localhost:3002',
      'X-Title': 'Converge Real-Time Extraction'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ 
        role: 'user', 
        content: EXTRACTION_PROMPT + transcript 
      }],
      max_tokens: 300, // Keep response small for speed
      temperature: 0.1, // Low temp for consistency
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in LLM response');
  }
  
  return JSON.parse(jsonMatch[0]);
}

/**
 * Extract profile information from transcript using lightweight LLM
 * @param {string} transcript - Transcript chunk to analyze
 * @param {object} existingProfile - Current profile data
 * @param {string} model - Model to use (optional)
 * @returns {Promise<object>} - Extracted updates
 */
export async function extractWithLLM(transcript, existingProfile = {}, model = DEFAULT_MODEL) {
  // Skip if transcript is too short
  if (!transcript || transcript.trim().length < 15) {
    return {};
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[LightweightExtractor] OPENROUTER_API_KEY missing, using heuristic extraction');
    return heuristicExtract(transcript, existingProfile);
  }

  try {
    const startTime = Date.now();
    
    // Call lightweight LLM
    const extracted = await callLightweightLLM(transcript, model);
    
    const latency = Date.now() - startTime;
    console.log(`[LightweightExtractor] ⚡ Extraction completed in ${latency}ms using ${model}`);
    
    // Build updates object (only include non-null values)
    const updates = {};
    
    // Profile fields
    if (extracted.name && (!existingProfile.name?.value || existingProfile.name.confidence !== 'high')) {
      updates.name = { value: extracted.name, confidence: 'high' };
    }
    
    if (extracted.company && (!existingProfile.company?.value || existingProfile.company.confidence !== 'high')) {
      updates.company = { value: extracted.company, confidence: 'high' };
    }
    
    if (extracted.role && (!existingProfile.role?.value || existingProfile.role.confidence !== 'high')) {
      updates.role = { value: extracted.role, confidence: 'high' };
    }
    
    if (extracted.institution && (!existingProfile.institution?.value || existingProfile.institution.confidence !== 'high')) {
      updates.institution = { value: extracted.institution, confidence: 'high' };
    }
    
    if (extracted.major && (!existingProfile.major?.value || existingProfile.major.confidence !== 'high')) {
      updates.major = { value: extracted.major, confidence: 'high' };
    }
    
    if (extracted.industry && (!existingProfile.industry?.value || existingProfile.industry.confidence !== 'high')) {
      updates.industry = { value: extracted.industry, confidence: 'high' };
    }
    
    // Return with topics and challenges
    return {
      profile: updates,
      topics_discussed: extracted.topics || [],
      their_challenges: extracted.challenges || [],
      _latency: latency
    };
    
  } catch (error) {
    console.error('[LightweightExtractor] ❌ Extraction failed:', error.message);
    return heuristicExtract(transcript, existingProfile);
  }
}

/**
 * Batch extraction for multiple transcripts
 * @param {string} fullTranscript - Complete accumulated transcript
 * @param {object} existingProfile - Current profile data
 * @param {string} model - Model to use (optional)
 * @returns {Promise<object>} - Extracted updates
 */
export async function batchExtractWithLLM(fullTranscript, existingProfile = {}, model = DEFAULT_MODEL) {
  // For batch processing, use slightly larger context
  if (!fullTranscript || fullTranscript.trim().length < 50) {
    return {};
  }

  // Truncate if too long (keep last 1000 chars for recency)
  const truncated = fullTranscript.length > 1000 
    ? fullTranscript.substring(fullTranscript.length - 1000)
    : fullTranscript;
  
  return extractWithLLM(truncated, existingProfile, model);
}

/**
 * Get model info (for logging/debugging)
 */
export function getModelInfo(modelKey = 'gemini-flash') {
  const models = {
    'gemini-flash': {
      name: 'Gemini 2.0 Flash',
      latency: '200-400ms',
      cost: '$0.000019/1K tokens (FREE during preview)',
      accuracy: '90-95%'
    },
    'gpt-4o-mini': {
      name: 'GPT-4o Mini',
      latency: '300-600ms',
      cost: '$0.00015/1K tokens',
      accuracy: '92-96%'
    },
    'claude-haiku': {
      name: 'Claude 3 Haiku',
      latency: '400-800ms',
      cost: '$0.00025/1K tokens',
      accuracy: '93-97%'
    }
  };
  
  return models[modelKey] || models['gemini-flash'];
}

export { MODELS };

