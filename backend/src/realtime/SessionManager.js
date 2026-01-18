/**
 * SessionManager - Centralized in-memory state manager for active recording sessions
 * 
 * Manages the "living" profile objects in server RAM, coordinating data from
 * Overshoot (visual) and LiveKit/Deepgram (audio) streams.
 */

import * as logger from '../utils/sessionLogger.js';

class SessionManager {
  constructor() {
    // In-memory Map: sessionId -> session state
    this.sessions = new Map();
    
    // Stale session cleanup interval (runs every 60 seconds)
    this.cleanupInterval = null;
    this.STALE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
    this.CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Create a new session with initial state
   * @param {string} sessionId - Unique session identifier
   * @param {string} userId - User ID (MongoDB ObjectId string)
   * @param {object} context - Event context { event: { name, type }, location: { name, city } }
   * @returns {object} Created session object
   */
  createSession(sessionId, userId, context) {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const now = new Date();
    const session = {
      userId,
      visual: {
        face_embedding: [],
        appearance: {
          description: '',
          distinctive_features: []
        },
        environment: {
          description: '',
          landmarks: []
        },
        headshot: {
          url: null,
          base64: null
        },
        faceMatch: {
          matched: false,
          connectionId: null,
          name: null,
          connectionData: null
        }
      },
      audio: {
        transcript_chunks: [], // Accumulated transcript fragments
        topics_discussed: [],
        their_challenges: [],
        follow_up_hooks: [],
        personal_details: [],
        transcript_summary: '',
        profile: {
          name: { value: null, confidence: 'low' },
          company: { value: null, confidence: 'low' },
          role: { value: null, confidence: 'low' }
        }
      },
      context: {
        event: context?.event || { name: 'Unknown Event', type: 'other' },
        location: context?.location || { name: 'Unknown', city: 'Unknown' }
      },
      startTime: now,
      lastActivity: now
    };

    this.sessions.set(sessionId, session);
    logger.logSessionCreated(sessionId, userId, context);
    return session;
  }

  /**
   * Update visual data from Overshoot channel
   * @param {string} sessionId - Session identifier
   * @param {object} visualData - Visual data payload from Overshoot
   */
  updateVisual(sessionId, visualData) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Merge visual data (Overshoot payload may have different structure)
    if (visualData.face_embedding) {
      session.visual.face_embedding = visualData.face_embedding;
    }
    
    if (visualData.appearance) {
      session.visual.appearance = {
        description: visualData.appearance.description || session.visual.appearance.description,
        distinctive_features: visualData.appearance.distinctive_features || session.visual.appearance.distinctive_features
      };
    }
    
    if (visualData.environment) {
      session.visual.environment = {
        description: visualData.environment.description || session.visual.environment.description,
        landmarks: visualData.environment.landmarks || session.visual.environment.landmarks
      };
    }
    
    if (visualData.headshot) {
      session.visual.headshot = {
        url: visualData.headshot.url || session.visual.headshot.url,
        base64: visualData.headshot.base64 || session.visual.headshot.base64
      };
    }

    // Update last activity timestamp
    session.lastActivity = new Date();
    
    logger.logVisualDataReceived(sessionId, session.visual);
    return session;
  }

  /**
   * Update face match results from face recognition
   * @param {string} sessionId - Session identifier
   * @param {object} matchData - Face match result data
   * @param {boolean} matchData.matched - Whether a match was found
   * @param {string|null} matchData.connectionId - MongoDB connection ID if matched
   * @param {string|null} matchData.name - Name of the matched person
   * @param {object|null} matchData.connectionData - Full connection data if matched
   */
  updateFaceMatch(sessionId, matchData) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.visual.faceMatch = {
      matched: matchData.matched || false,
      connectionId: matchData.connectionId || null,
      name: matchData.name || null,
      connectionData: matchData.connectionData || null
    };

    // Update last activity timestamp
    session.lastActivity = new Date();
    
    // Note: allMatches will be passed from the caller if available
    logger.logFaceMatchResult(sessionId, matchData.matched, {
      name: matchData.name,
      connectionId: matchData.connectionId,
      score: matchData.connectionData?.score
    });
    return session;
  }

  /**
   * Update audio data from LiveKit/Deepgram channel
   * @param {string} sessionId - Session identifier
   * @param {object} audioData - Audio data payload (transcript chunk or parsed profile)
   */
  updateAudio(sessionId, audioData) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // If it's a transcript chunk, accumulate it
    if (audioData.transcript) {
      logger.logTranscriptReceived(sessionId, audioData.transcript, audioData.is_final, audioData.speaker);
      
      session.audio.transcript_chunks.push({
        transcript: audioData.transcript,
        timestamp: new Date(),
        is_final: audioData.is_final || false,
        speaker: audioData.speaker
      });
    }

    // If it's parsed profile data (from LLM extraction), merge it
    if (audioData.profile) {
      // Merge profile fields (keep highest confidence)
      const confidenceOrder = { 'low': 1, 'medium': 2, 'high': 3 };
      ['name', 'company', 'role'].forEach(field => {
        const newField = audioData.profile[field];
        const currentField = session.audio.profile[field];
        
        if (newField?.value && 
            (!currentField?.value || 
             confidenceOrder[newField.confidence] > confidenceOrder[currentField.confidence])) {
          session.audio.profile[field] = { ...newField };
        }
      });
    }

    // Merge arrays (topics, challenges, hooks, personal details)
    if (audioData.topics_discussed) {
      session.audio.topics_discussed = Array.from(
        new Set([...session.audio.topics_discussed, ...audioData.topics_discussed])
      );
    }
    
    if (audioData.their_challenges) {
      session.audio.their_challenges = Array.from(
        new Set([...session.audio.their_challenges, ...audioData.their_challenges])
      );
    }
    
    if (audioData.follow_up_hooks) {
      // Merge hooks, avoiding duplicates
      const existingHooks = session.audio.follow_up_hooks.map(h => h.detail);
      audioData.follow_up_hooks.forEach(hook => {
        if (!existingHooks.includes(hook.detail)) {
          session.audio.follow_up_hooks.push(hook);
        }
      });
    }
    
    if (audioData.personal_details) {
      session.audio.personal_details = Array.from(
        new Set([...session.audio.personal_details, ...audioData.personal_details])
      );
    }
    
    if (audioData.transcript_summary) {
      session.audio.transcript_summary = audioData.transcript_summary;
    }

    // Update last activity timestamp
    session.lastActivity = new Date();
    
    // Log profile updates if profile data was merged
    if (audioData.profile) {
      const session = this.sessions.get(sessionId);
      ['name', 'company', 'role'].forEach(field => {
        const newField = audioData.profile[field];
        const currentField = session.audio.profile[field];
        if (newField?.value && newField.value !== currentField?.value) {
          logger.logProfileFieldUpdate(
            sessionId,
            field,
            currentField?.value,
            newField.value,
            currentField?.confidence,
            newField.confidence
          );
        }
      });
    }
    
    return session;
  }

  /**
   * Get current session state
   * @param {string} sessionId - Session identifier
   * @returns {object} Session state object
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  /**
   * Finalize session: snapshot state, return it, and purge from memory
   * @param {string} sessionId - Session identifier
   * @returns {object} Snapshot of session state (for MongoDB commit)
   */
  finalizeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Create snapshot (deep copy)
    const snapshot = {
      userId: session.userId,
      visual: JSON.parse(JSON.stringify(session.visual)),
      audio: JSON.parse(JSON.stringify(session.audio)),
      context: JSON.parse(JSON.stringify(session.context)),
      startTime: session.startTime,
      endTime: new Date(),
      duration: new Date() - session.startTime
    };

    // Purge from memory
    this.sessions.delete(sessionId);
    logger.logSessionFinalizationStarted(sessionId, snapshot.duration);

    return snapshot;
  }

  /**
   * Check for stale sessions and auto-finalize them
   * Called by cleanup interval
   */
  checkStaleSessions() {
    const now = new Date();
    const staleSessionIds = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now - session.lastActivity;
      if (idleTime > this.STALE_TIMEOUT_MS) {
        staleSessionIds.push(sessionId);
      }
    }

    if (staleSessionIds.length > 0) {
      logger.logStaleSessionCleanup(staleSessionIds);
      return staleSessionIds;
    }

    return [];
  }

  /**
   * Start background cleanup interval
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      return; // Already running
    }

    this.cleanupInterval = setInterval(() => {
      const staleIds = this.checkStaleSessions();
      // Note: Actual finalization will be handled by the caller (sessionSocket)
      // This just identifies stale sessions
    }, this.CLEANUP_INTERVAL_MS);

    console.log('[SessionManager] Started stale session cleanup interval');
  }

  /**
   * Stop cleanup interval (for testing/shutdown)
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[SessionManager] Stopped cleanup interval');
    }
  }

  /**
   * Get all active session IDs (for debugging/monitoring)
   * @returns {string[]} Array of session IDs
   */
  getActiveSessionIds() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session count (for monitoring)
   * @returns {number} Number of active sessions
   */
  getSessionCount() {
    return this.sessions.size;
  }
}

// Export singleton instance
export default new SessionManager();

