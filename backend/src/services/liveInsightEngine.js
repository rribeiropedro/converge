/**
 * LiveInsightEngine - Real-time LLM extraction for live transcript insights
 * 
 * Key Design Principles:
 * 1. FAST: Use a fast model (claude-3-haiku)
 * 2. INCREMENTAL: Only extract what's new since last extraction
 * 3. DEBOUNCED: Don't call LLM on every chunk, batch them
 * 4. DELTA-ONLY: Only emit changes to avoid UI flicker
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const LIVE_EXTRACTION_PROMPT = `Extract facts from this conversation as complete sentences. ONLY include what was EXPLICITLY stated.

Return JSON with complete sentence descriptions:

{
  "name": "His name is [name]",
  "company": "He works at [company]",
  "role": "He is a [role/title]",
  "institution": "He goes to school at [university]",
  "major": "He studies [major/field]",
  "topics": ["He mentioned working on [topic]", "They discussed [topic]"],
  "challenges": ["He needs help with [problem]"],
  "hooks": ["Send him [resource]", "Intro him to [person]"],
  "personal": ["He has a [pet/hobby/detail]", "He is from [place]"]
}

RULES:
- Write as complete sentences (e.g. "His name is Pedro" not just "Pedro")
- ONLY include facts that were EXPLICITLY stated in the transcript
- Return {} if nothing relevant was said
- NEVER invent or assume information not in the transcript`;

class LiveInsightEngine {
  constructor(sessionId, socket) {
    this.sessionId = sessionId;
    this.socket = socket;
    
    // Accumulated state
    this.transcriptBuffer = '';
    this.lastProcessedLength = 0;
    this.extractedData = {
      name: null,
      company: null,
      role: null,
      institution: null,
      major: null,
      topics: [],
      challenges: [],
      hooks: [],
      personal: []
    };
    
    // Debounce timer
    this.debounceTimer = null;
    this.DEBOUNCE_MS = 3000; // Process every 3 seconds
    this.MIN_NEW_CHARS = 50; // Minimum new characters before processing
    
    // Track if we're currently processing to avoid overlapping calls
    this.isProcessing = false;
    
    console.log(`[LiveInsightEngine] Created for session ${sessionId}`);
  }

  /**
   * Called when new transcript chunk arrives from Deepgram
   * @param {string} chunk - New transcript text
   * @param {boolean} isFinal - Whether this is a final transcript
   */
  addTranscript(chunk, isFinal) {
    if (!chunk || chunk.trim().length === 0) return;
    
    this.transcriptBuffer += ' ' + chunk.trim();
    
    // If final transcript and we have enough new content, process immediately
    if (isFinal && this.hasEnoughNewContent()) {
      this.processNow();
    } else if (this.hasEnoughNewContent()) {
      this.scheduleProcess();
    }
  }

  /**
   * Check if we have enough new content to warrant processing
   */
  hasEnoughNewContent() {
    const newContentLength = this.transcriptBuffer.length - this.lastProcessedLength;
    return newContentLength >= this.MIN_NEW_CHARS;
  }

  /**
   * Schedule debounced processing
   */
  scheduleProcess() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.processNow(), this.DEBOUNCE_MS);
  }

  /**
   * Process transcript immediately
   */
  async processNow() {
    // Prevent overlapping calls
    if (this.isProcessing) {
      this.scheduleProcess(); // Reschedule for later
      return;
    }
    
    // Get unprocessed text
    const newText = this.transcriptBuffer.slice(this.lastProcessedLength).trim();
    if (newText.length < 20) return; // Skip if too short
    
    this.isProcessing = true;
    this.lastProcessedLength = this.transcriptBuffer.length;
    
    try {
      console.log(`[LiveInsightEngine] Processing transcript: "${newText.substring(0, 100)}${newText.length > 100 ? '...' : ''}"`);
      const extracted = await this.callLLM(newText);
      
      // Log what was extracted for debugging
      const extractedKeys = Object.keys(extracted).filter(k => extracted[k] && (Array.isArray(extracted[k]) ? extracted[k].length > 0 : true));
      console.log(`[LiveInsightEngine] Extracted fields: ${extractedKeys.length > 0 ? extractedKeys.join(', ') : 'none'}`);
      
      const delta = this.computeDelta(extracted);
      
      if (delta.length > 0) {
        console.log(`[LiveInsightEngine] Emitting ${delta.length} insights:`, delta.map(d => d.text).join(' | '));
        this.emitInsights(delta);
      }
    } catch (err) {
      console.error('[LiveInsightEngine] LLM error:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Call LLM for extraction
   * @param {string} text - Transcript text to analyze
   */
  async callLLM(text) {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }
    
    const startTime = Date.now();
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Fast Gemini Flash model
        max_tokens: 512,
        temperature: 0, // Zero temperature for deterministic extraction - no creativity
        messages: [
          {
            role: 'system',
            content: 'You extract ONLY explicitly stated facts from transcripts. Never invent information. Return empty {} if nothing extractable was said.'
          },
          { 
            role: 'user', 
            content: `${LIVE_EXTRACTION_PROMPT}\n\n---\nTRANSCRIPT TO ANALYZE:\n"${text}"\n---\n\nExtract ONLY what was explicitly stated above. Return {} if nothing relevant was said.` 
          }
        ],
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log(`[LiveInsightEngine] LLM response in ${Date.now() - startTime}ms`);
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[LiveInsightEngine] No JSON found in LLM response');
      return {};
    }
    
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.warn('[LiveInsightEngine] Failed to parse LLM JSON:', e.message);
      return {};
    }
  }

  /**
   * Compute delta between new extraction and existing state
   * APPENDS new info, never replaces existing
   * @param {Object} newExtracted - Newly extracted data
   * @returns {Array} - Array of new bullet points (complete sentences)
   */
  computeDelta(newExtracted) {
    const bullets = [];
    
    // Profile fields - only add if we don't already have this info (never replace)
    const profileFields = ['name', 'company', 'role', 'institution', 'major'];
    
    for (const key of profileFields) {
      // Only add if: new value exists AND we don't already have this field
      if (newExtracted[key] && !this.extractedData[key]) {
        this.extractedData[key] = newExtracted[key];
        // The LLM returns complete sentences, use them directly
        bullets.push({ 
          type: 'profile', 
          field: key, 
          text: newExtracted[key],  // Already a complete sentence from LLM
          value: newExtracted[key]
        });
      }
    }
    
    // Array fields - always append new items (deduplicated)
    const arrayFields = ['topics', 'challenges', 'hooks', 'personal'];
    
    for (const key of arrayFields) {
      const newItems = newExtracted[key] || [];
      for (const item of newItems) {
        // Skip empty items
        if (!item || item.trim().length === 0) continue;
        
        // Deduplication: check if item is similar to existing
        const isDuplicate = this.extractedData[key].some(existing => 
          this.isSimilar(existing, item)
        );
        
        if (!isDuplicate) {
          this.extractedData[key].push(item);
          // The LLM returns complete sentences, use them directly
          bullets.push({ 
            type: key, 
            text: item,  // Already a complete sentence from LLM
            value: item
          });
        }
      }
    }
    
    return bullets;
  }

  /**
   * Check if two strings are similar (basic fuzzy match)
   */
  isSimilar(a, b) {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalize(a) === normalize(b) || 
           normalize(a).includes(normalize(b)) || 
           normalize(b).includes(normalize(a));
  }

  /**
   * Emit insights update to client via socket
   * @param {Array} bullets - New bullet points to emit
   */
  emitInsights(bullets) {
    // Build full state for overlay
    const fullState = {
      name: this.extractedData.name,
      company: this.extractedData.company,
      role: this.extractedData.role,
      institution: this.extractedData.institution,
      major: this.extractedData.major,
      topics: [...this.extractedData.topics],
      challenges: [...this.extractedData.challenges],
      hooks: [...this.extractedData.hooks],
      personal: [...this.extractedData.personal],
    };
    
    this.socket.emit('session:insights_update', {
      sessionId: this.sessionId,
      bullets,      // Just the new items (for animations/highlighting)
      fullState,    // Complete state (for full overlay rebuild)
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Extract clean value from a sentence like "My name is Pedro" -> "Pedro"
   */
  extractValue(sentence, patterns) {
    if (!sentence) return null;
    for (const pattern of patterns) {
      try {
        const match = sentence.match(new RegExp(pattern, 'i'));
        if (match && match[1]) return match[1].trim();
      } catch (e) {
        console.error(`[LiveInsightEngine] Error extracting value from sentence: ${sentence} with pattern: ${pattern}`, e.message);
        throw e;
      }
    }
    return sentence; // fallback to full sentence
  }

  /**
   * Get final state for MongoDB commit
   * Returns data structured for Connection schema
   * Extracts clean values from sentences for DB storage
   */
  getFinalState() {
    // Extract clean values from sentences
    const nameValue = this.extractValue(this.extractedData.name, [
      'name is (.+?)(?:\\.|,|$)', 'called (.+?)(?:\\.|,|$)', "I'm (.+?)(?:\\.|,|$)"
    ]);
    const companyValue = this.extractValue(this.extractedData.company, [
      'works? (?:at|for) (.+?)(?:\\.|,|$)', 'company (?:is|called) (.+?)(?:\\.|,|$)'
    ]);
    const roleValue = this.extractValue(this.extractedData.role, [
      'is an? (.+?)(?:\\.|,|$)', 'works? as an? (.+?)(?:\\.|,|$)', 'wants to work (?:as|in) an? (.+?)(?:\\.|,|$)'
    ]);
    const institutionValue = this.extractValue(this.extractedData.institution, [
      'school at (.+?)(?:\\.|,|$)', 'goes to (.+?)(?:\\.|,|$)', 'attends (.+?)(?:\\.|,|$)', 'student at (.+?)(?:\\.|,|$)'
    ]);
    const majorValue = this.extractValue(this.extractedData.major, [
      'studies (.+?)(?:\\.|,|$)', 'majoring in (.+?)(?:\\.|,|$)', 'major is (.+?)(?:\\.|,|$)'
    ]);

    const finalState = {
      // Profile fields with confidence structure - clean values for DB
      name: nameValue 
        ? { value: nameValue, confidence: 'medium', source: 'livekit' }
        : null,
      company: companyValue
        ? { value: companyValue, confidence: 'medium', source: 'livekit' }
        : null,
      role: roleValue
        ? { value: roleValue, confidence: 'medium', source: 'livekit' }
        : null,
      institution: institutionValue
        ? { value: institutionValue, confidence: 'medium', source: 'livekit' }
        : null,
      major: majorValue
        ? { value: majorValue, confidence: 'medium', source: 'livekit' }
        : null,
      
      // Audio fields
      audio: {
        topics_discussed: this.extractedData.topics,
        their_challenges: this.extractedData.challenges,
        follow_up_hooks: this.extractedData.hooks.map(h => ({ 
          type: 'other', 
          detail: h,
          completed: false,
          completed_at: null
        })),
        personal_details: this.extractedData.personal,
        transcript_summary: '' // Will be filled by final comprehensive parse
      },
      
      // Raw transcript for final processing
      fullTranscript: this.transcriptBuffer.trim()
    };

    // Log final state for MongoDB
    console.log(`[LiveInsightEngine] 📦 Final state for MongoDB:`);
    console.log(`  📝 Raw extracted data:`, JSON.stringify(this.extractedData, null, 2));
    console.log(`  🎯 Cleaned values for DB:`);
    console.log(`     - name: "${nameValue || 'null'}"`);
    console.log(`     - company: "${companyValue || 'null'}"`);
    console.log(`     - role: "${roleValue || 'null'}"`);
    console.log(`     - institution: "${institutionValue || 'null'}"`);
    console.log(`     - major: "${majorValue || 'null'}"`);
    console.log(`     - topics: [${this.extractedData.topics.join(', ')}]`);
    console.log(`     - challenges: [${this.extractedData.challenges.join(', ')}]`);
    console.log(`     - hooks: [${this.extractedData.hooks.join(', ')}]`);
    console.log(`     - personal: [${this.extractedData.personal.join(', ')}]`);

    return finalState;
  }

  /**
   * Get current extracted state (for debugging/monitoring)
   */
  getCurrentState() {
    return { ...this.extractedData };
  }

  /**
   * Cleanup timers on session end
   */
  cleanup() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    console.log(`[LiveInsightEngine] Cleaned up for session ${this.sessionId}`);
  }
}

export default LiveInsightEngine;

