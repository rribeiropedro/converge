/**
 * Session Logger - Human-readable logging for session pipeline events
 * 
 * Provides structured, readable logs for all major events and decisions
 * in the session lifecycle.
 */

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const formatTimestamp = () => {
  return new Date().toISOString();
};

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
};

const formatSessionId = (sessionId) => {
  if (!sessionId) return 'N/A';
  return sessionId.substring(0, 8) + '...';
};

const formatConnectionId = (connectionId) => {
  if (!connectionId) return 'N/A';
  // Return full ID for connection IDs
  return connectionId.toString();
};

/**
 * Log session creation
 */
export function logSessionCreated(sessionId, userId, context) {
  const event = context?.event?.name || 'Unknown Event';
  const location = context?.location?.city || 'Unknown Location';
  
  console.log(`\n${COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.green}✨ SESSION CREATED${COLORS.reset}`);
  console.log(`${COLORS.dim}${formatTimestamp()}${COLORS.reset}`);
  console.log(`  ${COLORS.cyan}Session ID:${COLORS.reset} ${formatSessionId(sessionId)}`);
  console.log(`  ${COLORS.cyan}User ID:${COLORS.reset} ${userId}`);
  console.log(`  ${COLORS.cyan}Event:${COLORS.reset} ${event}`);
  console.log(`  ${COLORS.cyan}Location:${COLORS.reset} ${location}`);
  console.log(`${COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);
}

/**
 * Log visual data received with full details
 */
export function logVisualDataReceived(sessionId, visualData) {
  console.log(`\n${COLORS.magenta}📸 VISUAL DATA RECEIVED${COLORS.reset} [${formatSessionId(sessionId)}]`);
  console.log(`  ${COLORS.dim}${formatTimestamp()}${COLORS.reset}`);

  // Check for appearance embedding (new 1536-dim text embedding)
  const hasAppearanceEmbedding = visualData.appearance_embedding && visualData.appearance_embedding.length > 0;
  const appearanceEmbeddingLength = hasAppearanceEmbedding ? visualData.appearance_embedding.length : 0;
  // Legacy: face embedding (128-dim)
  const hasFaceEmbedding = visualData.face_embedding && visualData.face_embedding.length > 0;
  const faceEmbeddingLength = hasFaceEmbedding ? visualData.face_embedding.length : 0;
  const hasAppearance = visualData.appearance?.description;
  const hasEnvironment = visualData.environment?.description;
  const hasHeadshot = visualData.headshot?.url || visualData.headshot?.base64;

  // Log appearance embedding (primary)
  console.log(`  ${hasAppearanceEmbedding ? COLORS.green + '✓' : COLORS.yellow + '○'} Appearance Embedding: ${hasAppearanceEmbedding ? `${appearanceEmbeddingLength}-dim text vector` : 'Not available'}`);
  if (hasAppearanceEmbedding) {
    console.log(`    ${COLORS.dim}First 5 values: [${visualData.appearance_embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]${COLORS.reset}`);
  }
  // Legacy: face embedding
  if (hasFaceEmbedding) {
    console.log(`  ${COLORS.dim}○ Face Embedding (legacy): ${faceEmbeddingLength}-dim vector${COLORS.reset}`);
  }
  
  console.log(`  ${hasAppearance ? COLORS.green + '✓' : COLORS.yellow + '○'} Appearance: ${hasAppearance ? 'Parsed' : 'Not available'}`);
  if (hasAppearance) {
    console.log(`    ${COLORS.dim}"${visualData.appearance.description.substring(0, 100)}${visualData.appearance.description.length > 100 ? '...' : ''}"${COLORS.reset}`);
    if (visualData.appearance.distinctive_features?.length > 0) {
      console.log(`    ${COLORS.dim}Features: ${visualData.appearance.distinctive_features.join(', ')}${COLORS.reset}`);
    }
  }
  
  console.log(`  ${hasEnvironment ? COLORS.green + '✓' : COLORS.yellow + '○'} Environment: ${hasEnvironment ? 'Parsed' : 'Not available'}`);
  if (hasEnvironment) {
    console.log(`    ${COLORS.dim}"${visualData.environment.description.substring(0, 100)}${visualData.environment.description.length > 100 ? '...' : ''}"${COLORS.reset}`);
  }
  
  console.log(`  ${hasHeadshot ? COLORS.green + '✓' : COLORS.yellow + '○'} Headshot: ${hasHeadshot ? 'Available' : 'Not available'}`);
  if (hasHeadshot) {
    if (visualData.headshot.url) {
      const urlPreview = visualData.headshot.url.length > 80 
        ? visualData.headshot.url.substring(0, 80) + '...' 
        : visualData.headshot.url;
      console.log(`    ${COLORS.cyan}URL:${COLORS.reset} ${urlPreview}`);
    }
    if (visualData.headshot.base64) {
      const base64Length = visualData.headshot.base64.length;
      console.log(`    ${COLORS.cyan}Base64:${COLORS.reset} ${base64Length} characters`);
    }
  }
}

/**
 * Log face matching attempt with embedding details
 */
export function logFaceMatchingStarted(sessionId, hasEmbedding, embeddingLength) {
  console.log(`\n${COLORS.blue}🔍 FACE MATCHING${COLORS.reset} [${formatSessionId(sessionId)}]`);
  console.log(`  ${COLORS.dim}${formatTimestamp()}${COLORS.reset}`);
  if (hasEmbedding) {
    console.log(`  ${COLORS.green}✓ Face embedding available${COLORS.reset} (${embeddingLength} dimensions)`);
    console.log(`  Searching database for matching face...`);
  } else {
    console.log(`  ${COLORS.yellow}⚠ No face embedding available${COLORS.reset}`);
    console.log(`  ${COLORS.dim}→ Cannot perform face matching - will create new connection${COLORS.reset}`);
  }
}

/**
 * Log face match result with full details
 */
export function logFaceMatchResult(sessionId, matched, matchData, allMatches = []) {
  if (matched && matchData) {
    const name = matchData.name || 'Unknown';
    const score = matchData.score ? `${Math.round(matchData.score * 100)}%` : 'N/A';
    const connectionId = matchData.connectionId ? formatConnectionId(matchData.connectionId) : 'N/A';
    
    console.log(`  ${COLORS.green}✓ MATCH FOUND${COLORS.reset}`);
    console.log(`    ${COLORS.cyan}Name:${COLORS.reset} ${name}`);
    console.log(`    ${COLORS.cyan}Confidence Score:${COLORS.reset} ${score}`);
    console.log(`    ${COLORS.cyan}Connection ID:${COLORS.reset} ${connectionId}`);
    
    if (allMatches.length > 0) {
      console.log(`    ${COLORS.cyan}All Matches Found:${COLORS.reset} ${allMatches.length}`);
      allMatches.forEach((match, idx) => {
        const matchName = match.connection?.name?.value || match.connection?.name || 'Unknown';
        const matchScore = match.score ? `${Math.round(match.score * 100)}%` : 'N/A';
        console.log(`      ${idx + 1}. ${matchName} (${matchScore})`);
      });
    }
    
    console.log(`    ${COLORS.bright}${COLORS.green}→ DECISION: UPDATE EXISTING CONNECTION${COLORS.reset}`);
    console.log(`    ${COLORS.dim}Reason: Face match found with ${score} confidence (threshold: 80%)${COLORS.reset}`);
  } else {
    console.log(`  ${COLORS.yellow}○ NO MATCH FOUND${COLORS.reset}`);
    if (allMatches.length > 0) {
      console.log(`    ${COLORS.cyan}Matches Found:${COLORS.reset} ${allMatches.length} (all below 80% threshold)`);
      allMatches.forEach((match, idx) => {
        const matchName = match.connection?.name?.value || match.connection?.name || 'Unknown';
        const matchScore = match.score ? `${Math.round(match.score * 100)}%` : 'N/A';
        console.log(`      ${idx + 1}. ${matchName} (${matchScore} - below threshold)`);
      });
    } else {
      console.log(`    ${COLORS.dim}No connections found in database${COLORS.reset}`);
    }
    console.log(`    ${COLORS.bright}${COLORS.yellow}→ DECISION: CREATE NEW CONNECTION${COLORS.reset}`);
    console.log(`    ${COLORS.dim}Reason: No face match found or match confidence below 80% threshold${COLORS.reset}`);
  }
  console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);
}

/**
 * Log audio chunk received
 */
export function logAudioChunkReceived(sessionId, chunkNumber, sizeBytes) {
  if (chunkNumber === 1 || chunkNumber % 20 === 0) {
    console.log(`${COLORS.dim}🎵 Audio chunk #${chunkNumber}${COLORS.reset} [${formatSessionId(sessionId)}] ${sizeBytes} bytes`);
  }
}

/**
 * Log Deepgram connection status
 */
export function logDeepgramConnection(sessionId, status, details = {}) {
  const statusColors = {
    starting: COLORS.yellow,
    opened: COLORS.green,
    error: COLORS.red,
    closed: COLORS.dim,
  };
  
  const statusEmojis = {
    starting: '🔄',
    opened: '✅',
    error: '❌',
    closed: '🔌',
  };
  
  const color = statusColors[status] || COLORS.white;
  const emoji = statusEmojis[status] || '•';
  
  console.log(`${color}${emoji} Deepgram ${status.toUpperCase()}${COLORS.reset} [${formatSessionId(sessionId)}]`);
  if (details.message) {
    console.log(`  ${COLORS.dim}${details.message}${COLORS.reset}`);
  }
}

/**
 * Log transcript received
 */
export function logTranscriptReceived(sessionId, transcript, isFinal, speaker) {
  const preview = transcript.length > 80 ? transcript.substring(0, 80) + '...' : transcript;
  const finalLabel = isFinal ? COLORS.green + 'FINAL' : COLORS.yellow + 'INTERIM';
  const speakerLabel = speaker ? ` [Speaker ${speaker}]` : '';
  
  console.log(`\n${COLORS.cyan}📝 TRANSCRIPT ${finalLabel}${COLORS.reset}${speakerLabel} [${formatSessionId(sessionId)}]`);
  console.log(`  ${COLORS.dim}${formatTimestamp()}${COLORS.reset}`);
  console.log(`  "${preview}"`);
  if (isFinal) {
    console.log(`${COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);
  }
}

/**
 * Log transcript parsing
 */
export function logTranscriptParsing(sessionId, transcriptLength) {
  console.log(`\n${COLORS.blue}🤖 TRANSCRIPT PARSING${COLORS.reset} [${formatSessionId(sessionId)}]`);
  console.log(`  ${COLORS.dim}${formatTimestamp()}${COLORS.reset}`);
  console.log(`  Analyzing ${transcriptLength} characters of transcript...`);
  console.log(`  Extracting profile data (name, company, role, topics, challenges, hooks)...`);
}

/**
 * Log profile extracted from transcript - FULL SCHEMA
 */
export function logProfileExtracted(sessionId, fullProfileData) {
  console.log(`  ${COLORS.green}✓ Profile Extracted${COLORS.reset}`);
  
  const profile = fullProfileData.profile || fullProfileData;
  const name = profile.name?.value || 'Not found';
  const nameConf = profile.name?.confidence || 'low';
  const company = profile.company?.value || 'Not found';
  const companyConf = profile.company?.confidence || 'low';
  const role = profile.role?.value || 'Not found';
  const roleConf = profile.role?.confidence || 'low';
  
  const confColors = {
    high: COLORS.green,
    medium: COLORS.yellow,
    low: COLORS.dim,
  };
  
  console.log(`    ${COLORS.cyan}Name:${COLORS.reset} ${name} ${confColors[nameConf]}[${nameConf}]${COLORS.reset}`);
  console.log(`    ${COLORS.cyan}Company:${COLORS.reset} ${company} ${confColors[companyConf]}[${companyConf}]${COLORS.reset}`);
  console.log(`    ${COLORS.cyan}Role:${COLORS.reset} ${role} ${confColors[roleConf]}[${roleConf}]${COLORS.reset}`);
  
  // Log full extracted schema
  console.log(`\n  ${COLORS.bright}${COLORS.cyan}📋 FULL EXTRACTED PROFILE SCHEMA:${COLORS.reset}`);
  console.log(`    ${COLORS.cyan}Topics Discussed:${COLORS.reset} ${(fullProfileData.topics_discussed || []).length} topics`);
  if (fullProfileData.topics_discussed?.length > 0) {
    fullProfileData.topics_discussed.forEach(topic => {
      console.log(`      • ${topic}`);
    });
  }
  
  console.log(`    ${COLORS.cyan}Their Challenges:${COLORS.reset} ${(fullProfileData.their_challenges || []).length} challenges`);
  if (fullProfileData.their_challenges?.length > 0) {
    fullProfileData.their_challenges.forEach(challenge => {
      console.log(`      • ${challenge}`);
    });
  }
  
  console.log(`    ${COLORS.cyan}Follow-up Hooks:${COLORS.reset} ${(fullProfileData.follow_up_hooks || []).length} hooks`);
  if (fullProfileData.follow_up_hooks?.length > 0) {
    fullProfileData.follow_up_hooks.forEach(hook => {
      console.log(`      • [${hook.type || 'other'}] ${hook.detail || hook}`);
    });
  }
  
  console.log(`    ${COLORS.cyan}Personal Details:${COLORS.reset} ${(fullProfileData.personal_details || []).length} details`);
  if (fullProfileData.personal_details?.length > 0) {
    fullProfileData.personal_details.forEach(detail => {
      console.log(`      • ${detail}`);
    });
  }
  
  if (fullProfileData.transcript_summary) {
    console.log(`    ${COLORS.cyan}Transcript Summary:${COLORS.reset}`);
    console.log(`      "${fullProfileData.transcript_summary.substring(0, 200)}${fullProfileData.transcript_summary.length > 200 ? '...' : ''}"`);
  }
  
  console.log(`${COLORS.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);
}

/**
 * Log session finalization start
 */
export function logSessionFinalizationStarted(sessionId, duration) {
  console.log(`\n${COLORS.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.magenta}🏁 SESSION FINALIZATION${COLORS.reset}`);
  console.log(`${COLORS.dim}${formatTimestamp()}${COLORS.reset}`);
  console.log(`  ${COLORS.cyan}Session ID:${COLORS.reset} ${formatSessionId(sessionId)}`);
  console.log(`  ${COLORS.cyan}Duration:${COLORS.reset} ${formatDuration(duration)}`);
  console.log(`  Processing session data...`);
}

/**
 * Log connection decision with full connection ID
 */
export function logConnectionDecision(sessionId, action, details) {
  if (action === 'updated') {
    console.log(`\n  ${COLORS.green}✓ DECISION: UPDATE EXISTING CONNECTION${COLORS.reset}`);
    console.log(`    ${COLORS.cyan}Connection ID:${COLORS.reset} ${formatConnectionId(details.connectionId)}`);
    console.log(`    ${COLORS.cyan}Name:${COLORS.reset} ${details.name || 'N/A'}`);
    console.log(`    ${COLORS.cyan}Reason:${COLORS.reset} Face match found (${details.matchScore ? Math.round(details.matchScore * 100) + '%' : 'N/A'} confidence)`);
    console.log(`    ${COLORS.dim}→ Adding new interaction to existing connection${COLORS.reset}`);
  } else if (action === 'created') {
    console.log(`\n  ${COLORS.yellow}○ DECISION: CREATE NEW CONNECTION${COLORS.reset}`);
    console.log(`    ${COLORS.cyan}Reason:${COLORS.reset} ${details.reason || 'No face match found'}`);
    console.log(`    ${COLORS.dim}→ Creating new draft connection${COLORS.reset}`);
  }
}

/**
 * Log session finalized with full connection ID
 */
export function logSessionFinalized(sessionId, connectionId, action, profile) {
  const actionColor = action === 'updated' ? COLORS.green : COLORS.yellow;
  const actionEmoji = action === 'updated' ? '✓' : '○';
  
  console.log(`\n  ${actionColor}${actionEmoji} SESSION FINALIZED${COLORS.reset}`);
  console.log(`    ${COLORS.cyan}Connection ID:${COLORS.reset} ${formatConnectionId(connectionId)}`);
  console.log(`    ${COLORS.cyan}Action:${COLORS.reset} ${action === 'updated' ? 'Updated existing' : 'Created new'}`);
  if (profile) {
    console.log(`    ${COLORS.cyan}Profile:${COLORS.reset} ${profile.name || 'N/A'} @ ${profile.company || 'N/A'}`);
  }
  console.log(`${COLORS.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);
}

/**
 * Log headshot generation
 */
export function logHeadshotGeneration(sessionId, status, details = {}) {
  console.log(`\n${COLORS.magenta}📷 HEADSHOT GENERATION${COLORS.reset} [${formatSessionId(sessionId)}]`);
  console.log(`  ${COLORS.dim}${formatTimestamp()}${COLORS.reset}`);
  
  if (status === 'started') {
    console.log(`  ${COLORS.yellow}🔄 Generating headshot using OpenRouter/Gemini...${COLORS.reset}`);
    console.log(`    ${COLORS.cyan}Input:${COLORS.reset} ${details.screenshotCount || 0} screenshots`);
  } else if (status === 'success') {
    console.log(`  ${COLORS.green}✓ Headshot Generated Successfully${COLORS.reset}`);
    if (details.imageUrl) {
      const urlPreview = details.imageUrl.length > 100 
        ? details.imageUrl.substring(0, 100) + '...' 
        : details.imageUrl;
      console.log(`    ${COLORS.cyan}Image URL:${COLORS.reset} ${urlPreview}`);
      if (details.imageUrl.startsWith('data:image')) {
        const base64Length = details.imageUrl.split(',')[1]?.length || 0;
        console.log(`    ${COLORS.cyan}Base64 Size:${COLORS.reset} ${base64Length} characters`);
      }
    }
    console.log(`    ${COLORS.dim}→ Will generate face embedding from headshot${COLORS.reset}`);
  } else if (status === 'error') {
    console.log(`  ${COLORS.red}❌ Headshot Generation Failed${COLORS.reset}`);
    console.log(`    ${COLORS.red}Error:${COLORS.reset} ${details.error || 'Unknown error'}`);
  }
  console.log(`${COLORS.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);
}

/**
 * Log face embedding generation
 */
export function logFaceEmbeddingGeneration(sessionId, status, details = {}) {
  if (status === 'started') {
    console.log(`  ${COLORS.blue}🔄 Generating face embedding from headshot...${COLORS.reset}`);
  } else if (status === 'success') {
    console.log(`  ${COLORS.green}✓ Face Embedding Generated${COLORS.reset}`);
    console.log(`    ${COLORS.cyan}Dimensions:${COLORS.reset} ${details.dimensions || 'N/A'}`);
    console.log(`    ${COLORS.dim}→ Ready for face matching${COLORS.reset}`);
  } else if (status === 'error') {
    console.log(`  ${COLORS.yellow}⚠ Face Embedding Generation Failed${COLORS.reset}`);
    console.log(`    ${COLORS.yellow}Error:${COLORS.reset} ${details.error || 'Unknown error'}`);
    console.log(`    ${COLORS.dim}→ Will treat as new contact${COLORS.reset}`);
  }
}

/**
 * Log stale session cleanup
 */
export function logStaleSessionCleanup(sessionIds) {
  if (sessionIds.length > 0) {
    console.log(`\n${COLORS.yellow}⏰ STALE SESSION CLEANUP${COLORS.reset}`);
    console.log(`  ${COLORS.dim}${formatTimestamp()}${COLORS.reset}`);
    console.log(`  Found ${sessionIds.length} stale session(s) (inactive > 10 minutes)`);
    sessionIds.forEach(id => {
      console.log(`    ${COLORS.dim}→ Auto-finalizing: ${formatSessionId(id)}${COLORS.reset}`);
    });
    console.log(`${COLORS.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);
  }
}

/**
 * Log error
 */
export function logError(sessionId, context, error) {
  console.log(`\n${COLORS.red}❌ ERROR${COLORS.reset} [${formatSessionId(sessionId)}]`);
  console.log(`  ${COLORS.dim}${formatTimestamp()}${COLORS.reset}`);
  console.log(`  ${COLORS.cyan}Context:${COLORS.reset} ${context}`);
  console.log(`  ${COLORS.red}Message:${COLORS.reset} ${error.message || error}`);
  if (error.stack) {
    console.log(`  ${COLORS.dim}${error.stack}${COLORS.reset}`);
  }
  console.log(`${COLORS.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);
}

/**
 * Log profile field update
 */
export function logProfileFieldUpdate(sessionId, field, oldValue, newValue, oldConf, newConf) {
  console.log(`  ${COLORS.cyan}📝 Profile Field Updated: ${field}${COLORS.reset}`);
  console.log(`    ${COLORS.dim}Old:${COLORS.reset} ${oldValue || 'N/A'} [${oldConf || 'low'}]`);
  console.log(`    ${COLORS.dim}New:${COLORS.reset} ${newValue || 'N/A'} [${newConf || 'low'}]`);
}
