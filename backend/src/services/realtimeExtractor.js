/**
 * Real-time keyword extraction from transcripts
 * Extracts profile information using pattern matching (no LLM needed)
 */

// Pattern matchers for different profile fields
const PATTERNS = {
  // Name patterns
  name: [
    /(?:my name is|i'm|i am|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /(?:^|\s)([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+here|\s+speaking)/i,
  ],
  
  // Company patterns
  company: [
    /(?:i work at|i'm with|i'm from|i represent|i'm at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /(?:work(?:ing)? (?:at|for))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /(?:company|organization) (?:is |called )?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  ],
  
  // Role patterns
  role: [
    /(?:i'm a|i am a|i'm an|i am an|i work as|my title is|my role is)\s+([a-z\s]+(?:engineer|developer|manager|director|vp|ceo|cto|cfo|president|analyst|designer|consultant|specialist|lead|head|officer))/i,
    /(?:vp of|director of|head of|lead)\s+([a-z\s]+)/i,
  ],
  
  // Institution patterns
  institution: [
    /(?:i studied at|i went to|i'm from|i attend|i'm attending|graduated from|alumni of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+University|\s+College|\s+Institute)?)/i,
    /(?:university|college|school) (?:is |called )?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  ],
  
  // Major patterns
  major: [
    /(?:my major is|i studied|i'm studying|degree in|major in)\s+([a-z\s]+(?:engineering|science|business|arts|studies|design|management))/i,
    /(?:computer science|electrical engineering|mechanical engineering|business administration|data science|biology|chemistry|physics|mathematics|english|history|psychology)/i,
  ],
  
  // Industry patterns
  industry: [
    /(?:i work in|industry is|in the|sector is)\s+([a-z\s]+(?:tech|finance|healthcare|education|retail|manufacturing|consulting))/i,
    /(?:software|technology|fintech|biotech|healthcare|education|finance|banking|consulting|retail|e-commerce|manufacturing|automotive|aerospace|energy)/i,
  ],
};

// Topic indicators
const TOPIC_KEYWORDS = [
  'about', 'discussing', 'talking about', 'regarding', 'concerning',
  'interested in', 'working on', 'building', 'developing', 'exploring'
];

/**
 * Extract profile information from a transcript chunk
 * @param {string} transcript - The transcript text to analyze
 * @param {object} existingProfile - Current profile data to update
 * @returns {object} - Extracted updates { field: { value, confidence } }
 */
export function extractFromTranscript(transcript, existingProfile = {}) {
  const updates = {};
  
  // Extract name
  if (!existingProfile.name?.value || existingProfile.name.confidence === 'low') {
    for (const pattern of PATTERNS.name) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Validate it's a reasonable name (2-50 chars, not all caps)
        if (name.length >= 2 && name.length <= 50 && !name.match(/^[A-Z\s]+$/)) {
          updates.name = { value: name, confidence: 'high' };
          break;
        }
      }
    }
  }
  
  // Extract company
  if (!existingProfile.company?.value || existingProfile.company.confidence === 'low') {
    for (const pattern of PATTERNS.company) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        // Validate it's a reasonable company name
        if (company.length >= 2 && company.length <= 50) {
          updates.company = { value: company, confidence: 'high' };
          break;
        }
      }
    }
  }
  
  // Extract role
  if (!existingProfile.role?.value || existingProfile.role.confidence === 'low') {
    for (const pattern of PATTERNS.role) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const role = match[1].trim();
        if (role.length >= 3 && role.length <= 50) {
          updates.role = { value: role, confidence: 'high' };
          break;
        }
      }
    }
  }
  
  // Extract institution
  if (!existingProfile.institution?.value || existingProfile.institution.confidence === 'low') {
    for (const pattern of PATTERNS.institution) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const institution = match[1].trim();
        if (institution.length >= 3 && institution.length <= 100) {
          updates.institution = { value: institution, confidence: 'high' };
          break;
        }
      }
    }
  }
  
  // Extract major
  if (!existingProfile.major?.value || existingProfile.major.confidence === 'low') {
    for (const pattern of PATTERNS.major) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const major = match[1].trim();
        if (major.length >= 3 && major.length <= 100) {
          updates.major = { value: major, confidence: 'medium' };
          break;
        }
      }
    }
  }
  
  // Extract industry
  if (!existingProfile.industry?.value || existingProfile.industry.confidence === 'low') {
    for (const pattern of PATTERNS.industry) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const industry = match[1].trim();
        if (industry.length >= 3 && industry.length <= 50) {
          updates.industry = { value: industry, confidence: 'medium' };
          break;
        }
      }
    }
  }
  
  return updates;
}

/**
 * Extract topics from a transcript chunk
 * @param {string} transcript - The transcript text
 * @returns {array} - Array of detected topics
 */
export function extractTopics(transcript) {
  const topics = [];
  const lowerTranscript = transcript.toLowerCase();
  
  // Look for topic indicators followed by content
  for (const keyword of TOPIC_KEYWORDS) {
    const index = lowerTranscript.indexOf(keyword);
    if (index !== -1) {
      // Extract the next few words as the topic
      const afterKeyword = transcript.substring(index + keyword.length).trim();
      const words = afterKeyword.split(/\s+/).slice(0, 5); // Get next 5 words
      if (words.length >= 2) {
        const topic = words.join(' ').replace(/[.,!?;:]+$/, ''); // Remove trailing punctuation
        if (topic.length >= 5 && topic.length <= 100) {
          topics.push(topic);
        }
      }
    }
  }
  
  // Extract common tech/business topics
  const commonTopics = [
    'artificial intelligence', 'machine learning', 'deep learning', 'ai', 'ml',
    'blockchain', 'cryptocurrency', 'web3', 'nft',
    'cloud computing', 'aws', 'azure', 'gcp',
    'mobile development', 'ios', 'android',
    'data science', 'analytics', 'big data',
    'cybersecurity', 'security',
    'devops', 'ci/cd', 'automation',
    'frontend', 'backend', 'full stack', 'full-stack',
    'product management', 'product design', 'ux', 'ui',
    'marketing', 'sales', 'business development',
    'fundraising', 'venture capital', 'investment',
    'startup', 'entrepreneurship', 'innovation',
    'remote work', 'hybrid work',
    'sustainability', 'climate tech', 'green tech',
  ];
  
  for (const topic of commonTopics) {
    if (lowerTranscript.includes(topic)) {
      topics.push(topic);
    }
  }
  
  return [...new Set(topics)]; // Remove duplicates
}

/**
 * Extract challenges/problems mentioned
 * @param {string} transcript - The transcript text
 * @returns {array} - Array of detected challenges
 */
export function extractChallenges(transcript) {
  const challenges = [];
  const lowerTranscript = transcript.toLowerCase();
  
  const challengeIndicators = [
    'problem', 'issue', 'challenge', 'difficulty', 'struggle',
    'hard to', 'difficult to', 'trouble', 'obstacle', 'bottleneck',
    'pain point', 'roadblock', 'hurdle'
  ];
  
  for (const indicator of challengeIndicators) {
    const index = lowerTranscript.indexOf(indicator);
    if (index !== -1) {
      // Extract context around the challenge
      const start = Math.max(0, index - 20);
      const end = Math.min(transcript.length, index + 80);
      const context = transcript.substring(start, end).trim();
      
      if (context.length >= 10 && context.length <= 200) {
        challenges.push(context);
      }
    }
  }
  
  return [...new Set(challenges)]; // Remove duplicates
}

