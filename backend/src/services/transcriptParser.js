const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(prompt) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-20250514',
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

  return validateAndNormalize(parsed);
}

export function validateAndNormalize(parsed) {
  const result = {
    profile: {
      name: normalizeField(parsed.profile?.name),
      company: normalizeField(parsed.profile?.company),
      role: normalizeField(parsed.profile?.role),
    },
    topics_discussed: Array.isArray(parsed.topics_discussed) ? parsed.topics_discussed : [],
    their_challenges: Array.isArray(parsed.their_challenges) ? parsed.their_challenges : [],
    follow_up_hooks: normalizeFollowUpHooks(parsed.follow_up_hooks),
    personal_details: Array.isArray(parsed.personal_details) ? parsed.personal_details : [],
    transcript_summary: parsed.transcript_summary || '',
  };

  return result;
}

function normalizeField(field) {
  if (!field) {
    return { value: null, confidence: 'low' };
  }
  return {
    value: field.value || null,
    confidence: ['high', 'medium', 'low'].includes(field.confidence) ? field.confidence : 'low',
  };
}

function normalizeFollowUpHooks(hooks) {
  if (!Array.isArray(hooks)) {
    return [];
  }

  const validTypes = ['resource_share', 'intro_request', 'meeting', 'other'];

  return hooks.map(hook => ({
    type: validTypes.includes(hook.type) ? hook.type : 'other',
    detail: hook.detail || '',
  }));
}
