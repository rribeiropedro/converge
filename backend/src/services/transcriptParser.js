import { validateAudioData, normalizeProfileField, normalizeFollowUpHook } from './schemaValidator.js';

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

const EXTRACTION_PROMPT = `You are an AI assistant that extracts structured profile data from conversation transcripts.

Analyze the following conversation transcript and extract:
1. The person's name (if mentioned)
2. Their company/organization (if mentioned)
3. Their role/job title (if mentioned)
4. Topics discussed during the conversation
5. Challenges or problems they mentioned
6. Follow-up hooks (things to follow up on, like resources to share, introductions to make)
7. Personal details (hobbies, pets, travel plans, etc.)

For each identity field (name, company, role), provide a confidence score:
- "high": Explicitly stated and clear
- "medium": Inferred or partially mentioned
- "low": Guessed or very uncertain

Return ONLY valid JSON in this exact format:
{
  "profile": {
    "name": { "value": "Full Name", "confidence": "high|medium|low" },
    "company": { "value": "Company Name", "confidence": "high|medium|low" },
    "role": { "value": "Job Title", "confidence": "high|medium|low" }
  },
  "topics_discussed": ["topic1", "topic2"],
  "their_challenges": ["challenge1"],
  "follow_up_hooks": [
    { "type": "resource_share|intro_request|meeting|other", "detail": "description" }
  ],
  "personal_details": ["detail1"],
  "transcript_summary": "2-3 sentence summary of the conversation"
}

If a field is not found, use null for value and "low" for confidence.`;

export async function parseTranscript(transcript) {
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcript is empty or invalid');
  }

  const responseText = await callOpenRouter(`${EXTRACTION_PROMPT}\n\nTRANSCRIPT:\n${transcript}`);

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from LLM response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate with Zod schema (ensures alignment with MongoDB schema)
  const validated = validateAudioData(parsed);

  // Normalize to match MongoDB schema structure (adds 'source' field)
  return normalizeForMongoDB(validated);
}

/**
 * Normalizes validated audio data to match MongoDB Connection schema
 * Adds 'source' field to profile fields
 */
function normalizeForMongoDB(validated) {
  return {
    profile: {
      name: normalizeProfileField(validated.profile?.name, 'livekit'),
      company: normalizeProfileField(validated.profile?.company, 'livekit'),
      role: validated.profile?.role 
        ? normalizeProfileField(validated.profile.role, 'livekit')
        : { value: null, confidence: 'low', source: 'livekit' },
    },
    topics_discussed: validated.topics_discussed || [],
    their_challenges: validated.their_challenges || [],
    follow_up_hooks: (validated.follow_up_hooks || []).map(normalizeFollowUpHook),
    personal_details: validated.personal_details || [],
    transcript_summary: validated.transcript_summary || '',
  };
}
