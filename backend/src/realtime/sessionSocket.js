import SessionManager from './SessionManager.js';
import { createLiveTranscriptionConnection, LiveTranscriptionEvents } from '../controllers/transcribeController.js';
import { parseVisualData } from '../services/visualParser.js';
import { parseTranscript } from '../services/transcriptParser.js';
import { createDraftConnection } from '../services/processingService.js';
import LiveInsightEngine from '../services/liveInsightEngine.js';

const SESSION_NAMESPACE = '/api/session';

// Module-level map to track sessionId -> socket for cross-module communication
const sessionSocketMap = new Map();

/**
 * Get the socket associated with a session ID
 * @param {string} sessionId - Session identifier
 * @returns {object|null} Socket.io socket or null if not found
 */
export const getSocketBySessionId = (sessionId) => {
  return sessionSocketMap.get(sessionId) || null;
};

const toBuffer = (chunk) => {
  if (!chunk) return null;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof ArrayBuffer) return Buffer.from(chunk);
  if (ArrayBuffer.isView(chunk)) return Buffer.from(chunk);
  return Buffer.from(chunk);
};

/**
 * Register session WebSocket namespace
 * Handles unified session lifecycle for both visual and audio streams
 */
export const registerSessionSocket = (io) => {
  const namespace = io.of(SESSION_NAMESPACE);

  namespace.on('connection', (socket) => {
    console.log(`[SessionSocket] Client connected: ${socket.id}`);

    // Per-socket state
    let deepgramConnection = null;
    let currentSessionId = null;
    let deepgramReady = false;
    let audioQueue = []; // Queue chunks until connection is ready
    let insightEngine = null; // Real-time LLM insight extraction

    const closeDeepgramConnection = () => {
      if (!deepgramConnection) return;
      try {
        deepgramConnection.finish?.();
      } catch (error) {
        // Ignore cleanup errors
      }
      try {
        deepgramConnection.close?.();
      } catch (error) {
        // Ignore cleanup errors
      }
      deepgramConnection = null;
      deepgramReady = false;
      audioQueue = [];
    };

    const startDeepgramConnection = (options = {}) => {
      if (deepgramConnection) return;

      console.log(`[SessionSocket] Starting Deepgram connection for session ${currentSessionId}`);

      try {
        deepgramConnection = createLiveTranscriptionConnection({
          model: 'nova-3',
          language: 'en',
          diarize: true,
          smart_format: true,
          interim_results: true,  // Get results while speaking, not just at end
          encoding: 'opus',       // Required for WebM/Opus streams - Deepgram can't auto-detect in live mode
          ...options
        });
        console.log(`[SessionSocket] Deepgram connection created for session ${currentSessionId}`);
      } catch (error) {
        console.error(`[SessionSocket] Failed to create Deepgram connection:`, error);
        socket.emit('session:error', { message: `Deepgram error: ${error.message}` });
        return;
      }

      deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log(`[SessionSocket] Deepgram connection opened for session ${currentSessionId}`);
        deepgramReady = true;
        
        // Flush queued audio chunks now that connection is ready
        if (audioQueue.length > 0) {
          console.log(`[SessionSocket] Flushing ${audioQueue.length} queued audio chunks`);
          audioQueue.forEach(buffer => deepgramConnection.send(buffer));
          audioQueue = [];
        }
        
        socket.emit('session:audio_ready');
      });

      deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        if (!currentSessionId) return;

        const alternative = data.channel?.alternatives?.[0];
        const transcript = alternative?.transcript || '';
        const words = alternative?.words || [];
        const speakers = new Set(
          words.map((word) => word.speaker).filter((speaker) => speaker !== undefined)
        );
        const speaker = speakers.size > 1 ? `${words[0]?.speaker}+` : words[0]?.speaker;

        // Log all Deepgram responses (even empty ones) for debugging
        console.log(`[SessionSocket] Deepgram response: is_final=${data.is_final}, transcript="${transcript.substring(0, 50)}${transcript.length > 50 ? '...' : ''}"`);

        if (!transcript) return;

        // Feed transcript to LiveInsightEngine for real-time LLM extraction
        if (insightEngine) {
          insightEngine.addTranscript(transcript, data.is_final);
        }

        // Update session with transcript chunk
        try {
          SessionManager.updateAudio(currentSessionId, {
            transcript,
            is_final: data.is_final,
            speaker
          });

          // Emit delta update to client
          const session = SessionManager.getSession(currentSessionId);
          socket.emit('session:audio_update', {
            transcript_chunk: transcript,
            is_final: data.is_final,
            speaker,
            accumulated_transcript: session.audio.transcript_chunks
              .map(chunk => chunk.transcript)
              .join(' ')
          });
        } catch (error) {
          console.error(`[SessionSocket] Error updating audio for session ${currentSessionId}:`, error);
          socket.emit('session:error', { message: error.message });
        }
      });

      deepgramConnection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error(`[SessionSocket] ❌ Deepgram error:`, error);
        socket.emit('session:error', {
          message: `Deepgram error: ${error?.message || 'Unknown error'}`,
          details: error
        });
      });

      deepgramConnection.on(LiveTranscriptionEvents.Close, (code, reason) => {
        console.log(`[SessionSocket] Deepgram connection closed for session ${currentSessionId}, code=${code}, reason=${reason || 'none'}`);
        closeDeepgramConnection();
      });
      
      // Add metadata/warning events for debugging
      deepgramConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
        console.log(`[SessionSocket] Deepgram metadata:`, JSON.stringify(data));
      });
      
      deepgramConnection.on(LiveTranscriptionEvents.Warning, (warning) => {
        console.warn(`[SessionSocket] ⚠️ Deepgram warning:`, warning);
      });
      
      // Unhandled events for debugging
      deepgramConnection.on(LiveTranscriptionEvents.Unhandled, (data) => {
        console.log(`[SessionSocket] Deepgram unhandled event:`, JSON.stringify(data));
      });
    };

    // Event: session:start
    socket.on('session:start', async (data) => {
      try {
        const { sessionId, userId, context } = data;

        if (!sessionId || !userId) {
          socket.emit('session:error', { message: 'sessionId and userId are required' });
          return;
        }

        // Create session in SessionManager
        SessionManager.createSession(sessionId, userId, context || {});
        currentSessionId = sessionId;

        // Store socket reference for cross-module communication
        sessionSocketMap.set(sessionId, socket);

        // Create LiveInsightEngine for real-time transcript extraction
        insightEngine = new LiveInsightEngine(sessionId, socket);

        console.log(`[SessionSocket] Session started: ${sessionId} for user ${userId}`);

        // Emit ready event
        socket.emit('session:ready', {
          sessionId,
          message: 'Session initialized'
        });
      } catch (error) {
        console.error('[SessionSocket] Error starting session:', error);
        socket.emit('session:error', { message: error.message });
      }
    });

    // Event: session:visual - Handle Overshoot visual data
    socket.on('session:visual', async (data) => {
      try {
        if (!currentSessionId) {
          socket.emit('session:error', { message: 'No active session. Call session:start first.' });
          return;
        }

        // Parse visual data (may need processing via visualParser)
        let visualData = data;
        
        // If it's raw Overshoot payload, parse it
        if (data.result && typeof data.result === 'string') {
          try {
            visualData = JSON.parse(data.result);
          } catch (e) {
            visualData = data;
          }
        }

        // Process visual data (face embedding, appearance, etc.)
        const parsedVisual = await parseVisualData(visualData);

        // Update session
        SessionManager.updateVisual(currentSessionId, parsedVisual);

        // Get updated session state
        const session = SessionManager.getSession(currentSessionId);

        // Emit visual update to client
        socket.emit('session:visual_update', {
          visual: {
            face_embedding: session.visual.face_embedding.length > 0,
            appearance: session.visual.appearance.description,
            environment: session.visual.environment.description
          },
          message: 'Visual intel locked'
        });
      } catch (error) {
        console.error('[SessionSocket] Error updating visual data:', error);
        socket.emit('session:error', { message: error.message });
      }
    });

    // Event: session:audio - Handle audio chunks for transcription
    let audioChunkCount = 0;
    socket.on('session:audio', (chunk) => {
      try {
        if (!currentSessionId) {
          socket.emit('session:error', { message: 'No active session. Call session:start first.' });
          return;
        }

        // Start Deepgram connection if not already started
        if (!deepgramConnection) {
          startDeepgramConnection();
        }

        // Forward audio chunk to Deepgram
        const buffer = toBuffer(chunk);
        if (buffer) {
          audioChunkCount++;
          // Log first chunk and then every 20th chunk to avoid spam
          if (audioChunkCount === 1 || audioChunkCount % 20 === 0) {
            console.log(`[SessionSocket] 🎵 Audio chunk #${audioChunkCount} received (${buffer.length} bytes)`);
          }
          
          // Queue chunks until connection is ready, then send directly
          if (deepgramReady && deepgramConnection) {
            deepgramConnection.send(buffer);
          } else {
            audioQueue.push(buffer);
          }
        }
      } catch (error) {
        console.error('[SessionSocket] Error processing audio chunk:', error);
        socket.emit('session:error', { message: error.message });
      }
    });

    // Event: session:end - Finalize session and commit to MongoDB
    socket.on('session:end', async () => {
      try {
        if (!currentSessionId) {
          socket.emit('session:error', { message: 'No active session to end.' });
          return;
        }

        // Close Deepgram connection
        closeDeepgramConnection();

        console.log(`[SessionSocket] ════════════════════════════════════════════════`);
        console.log(`[SessionSocket] 🔚 ENDING SESSION: ${currentSessionId}`);
        console.log(`[SessionSocket] ════════════════════════════════════════════════`);

        // Get LiveInsightEngine's extracted data (real-time LLM extractions)
        const insightState = insightEngine ? insightEngine.getFinalState() : null;
        
        console.log(`[SessionSocket] 📊 InsightEngine state received:`, insightState ? 'YES' : 'NULL');
        
        // Clean up insight engine
        if (insightEngine) {
          insightEngine.cleanup();
          insightEngine = null;
        }

        // Get session snapshot
        const sessionSnapshot = SessionManager.finalizeSession(currentSessionId);
        console.log(`[SessionSocket] 📸 Session snapshot: userId=${sessionSnapshot.userId}, chunks=${sessionSnapshot.audio.transcript_chunks.length}`);

        // Start with insight engine data (already has profile fields extracted)
        let audioData = {
          profile: sessionSnapshot.audio.profile,
          topics_discussed: insightState?.audio?.topics_discussed || sessionSnapshot.audio.topics_discussed,
          their_challenges: insightState?.audio?.their_challenges || sessionSnapshot.audio.their_challenges,
          follow_up_hooks: insightState?.audio?.follow_up_hooks || sessionSnapshot.audio.follow_up_hooks,
          personal_details: insightState?.audio?.personal_details || sessionSnapshot.audio.personal_details,
          transcript_summary: sessionSnapshot.audio.transcript_summary
        };

        // Merge insight engine profile fields with existing (prefer insight engine if it has data)
        const profileFromInsight = {};
        if (insightState?.name) profileFromInsight.name = insightState.name;
        if (insightState?.company) profileFromInsight.company = insightState.company;
        if (insightState?.role) profileFromInsight.role = insightState.role;
        
        audioData.profile = {
          name: profileFromInsight.name || audioData.profile.name,
          company: profileFromInsight.company || audioData.profile.company,
          role: profileFromInsight.role || audioData.profile.role,
        };

        // If we have transcript chunks but no summary, parse the full transcript for a comprehensive summary
        if (sessionSnapshot.audio.transcript_chunks.length > 0 && !audioData.transcript_summary) {
          const fullTranscript = insightState?.fullTranscript || sessionSnapshot.audio.transcript_chunks
            .map(chunk => chunk.transcript)
            .join(' ')
            .trim();

          if (fullTranscript) {
            try {
              // Parse transcript to extract profile data (comprehensive final pass)
              const parsed = await parseTranscript(fullTranscript);
              
              // Merge parsed data with existing audio data
              // Only override if parsed has higher confidence
              audioData = {
                ...audioData,
                topics_discussed: [...new Set([...audioData.topics_discussed, ...parsed.topics_discussed])],
                their_challenges: [...new Set([...audioData.their_challenges, ...parsed.their_challenges])],
                personal_details: [...new Set([...audioData.personal_details, ...parsed.personal_details])],
                transcript_summary: parsed.transcript_summary || audioData.transcript_summary,
                // Keep existing profile unless parsed has high confidence
                profile: {
                  name: parsed.profile.name?.confidence === 'high' ? parsed.profile.name : audioData.profile.name,
                  company: parsed.profile.company?.confidence === 'high' ? parsed.profile.company : audioData.profile.company,
                  role: parsed.profile.role?.confidence === 'high' ? parsed.profile.role : audioData.profile.role
                }
              };
            } catch (error) {
              console.warn('[SessionSocket] Failed to parse transcript, using accumulated data:', error);
              audioData.transcript_summary = fullTranscript.substring(0, 500); // Truncate if too long
            }
          }
        }

        // Prepare visual data with institution/major from insight engine
        const visualData = {
          ...sessionSnapshot.visual,
        };

        // Log what we're about to save
        console.log(`[SessionSocket] ────────────────────────────────────────────────`);
        console.log(`[SessionSocket] 💾 SAVING TO MONGODB:`);
        console.log(`[SessionSocket] ────────────────────────────────────────────────`);
        console.log(`[SessionSocket]   Profile:`);
        console.log(`[SessionSocket]     - name: ${JSON.stringify(audioData.profile.name)}`);
        console.log(`[SessionSocket]     - company: ${JSON.stringify(audioData.profile.company)}`);
        console.log(`[SessionSocket]     - role: ${JSON.stringify(audioData.profile.role)}`);
        console.log(`[SessionSocket]     - institution: ${JSON.stringify(insightState?.institution)}`);
        console.log(`[SessionSocket]     - major: ${JSON.stringify(insightState?.major)}`);
        console.log(`[SessionSocket]   Audio data:`);
        console.log(`[SessionSocket]     - topics_discussed: [${audioData.topics_discussed?.slice(0, 3).join(', ')}${audioData.topics_discussed?.length > 3 ? '...' : ''}]`);
        console.log(`[SessionSocket]     - their_challenges: [${audioData.their_challenges?.slice(0, 3).join(', ')}${audioData.their_challenges?.length > 3 ? '...' : ''}]`);
        console.log(`[SessionSocket]     - follow_up_hooks: ${audioData.follow_up_hooks?.length || 0} items`);
        console.log(`[SessionSocket]     - personal_details: [${audioData.personal_details?.slice(0, 3).join(', ')}${audioData.personal_details?.length > 3 ? '...' : ''}]`);
        console.log(`[SessionSocket]     - transcript_summary: "${(audioData.transcript_summary || '').substring(0, 100)}..."`);
        console.log(`[SessionSocket]   Visual data:`);
        console.log(`[SessionSocket]     - face_embedding: ${visualData.face_embedding?.length || 0} dimensions`);
        console.log(`[SessionSocket]     - headshot: ${visualData.headshot ? 'YES' : 'NO'}`);
        console.log(`[SessionSocket] ────────────────────────────────────────────────`);

        // Create draft connection in MongoDB
        const draftConnection = await createDraftConnection(
          audioData,
          visualData,
          sessionSnapshot.context,
          sessionSnapshot.userId,
          false, // Not temporary
          {
            // Pass additional profile fields from insight engine
            institution: insightState?.institution || null,
            major: insightState?.major || null,
          }
        );

        console.log(`[SessionSocket] ✅ SAVED! Connection ID: ${draftConnection._id}`);
        console.log(`[SessionSocket] ════════════════════════════════════════════════`);

        // Emit finalized event with connection details
        socket.emit('session:finalized', {
          connectionId: draftConnection._id.toString(),
          profile: {
            name: draftConnection.name.value,
            company: draftConnection.company.value,
            status: draftConnection.status
          },
          message: 'Session finalized and saved to database'
        });

        // Clean up socket reference
        sessionSocketMap.delete(currentSessionId);
        currentSessionId = null;
      } catch (error) {
        console.error('[SessionSocket] Error finalizing session:', error);
        socket.emit('session:error', { message: error.message });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[SessionSocket] Client disconnected: ${socket.id}`);
      
      // Close Deepgram connection
      closeDeepgramConnection();

      // Clean up insight engine
      if (insightEngine) {
        insightEngine.cleanup();
        insightEngine = null;
      }

      // If there's an active session, check if it should be auto-finalized
      if (currentSessionId) {
        // Clean up socket reference
        sessionSocketMap.delete(currentSessionId);
        
        const staleIds = SessionManager.checkStaleSessions();
        if (staleIds.includes(currentSessionId)) {
          console.log(`[SessionSocket] Auto-finalizing stale session ${currentSessionId} on disconnect`);
          // Note: We could auto-finalize here, but it's safer to let the cleanup interval handle it
          // to avoid race conditions
        }
      }

      currentSessionId = null;
    });
  });

  // Handle stale session cleanup
  setInterval(() => {
    const staleIds = SessionManager.checkStaleSessions();
    if (staleIds.length > 0) {
      console.log(`[SessionSocket] Auto-finalizing ${staleIds.length} stale session(s)`);
      
      staleIds.forEach(async (sessionId) => {
        try {
          const sessionSnapshot = SessionManager.finalizeSession(sessionId);
          
          // Parse and save to MongoDB (same logic as session:end)
          let audioData = {
            profile: sessionSnapshot.audio.profile,
            topics_discussed: sessionSnapshot.audio.topics_discussed,
            their_challenges: sessionSnapshot.audio.their_challenges,
            follow_up_hooks: sessionSnapshot.audio.follow_up_hooks,
            personal_details: sessionSnapshot.audio.personal_details,
            transcript_summary: sessionSnapshot.audio.transcript_summary
          };

          if (sessionSnapshot.audio.transcript_chunks.length > 0 && !audioData.transcript_summary) {
            const fullTranscript = sessionSnapshot.audio.transcript_chunks
              .map(chunk => chunk.transcript)
              .join(' ')
              .trim();

            if (fullTranscript) {
              try {
                const parsed = await parseTranscript(fullTranscript);
                audioData = {
                  ...parsed,
                  profile: {
                    name: parsed.profile.name?.confidence === 'high' ? parsed.profile.name : audioData.profile.name,
                    company: parsed.profile.company?.confidence === 'high' ? parsed.profile.company : audioData.profile.company,
                    role: parsed.profile.role?.confidence === 'high' ? parsed.profile.role : audioData.profile.role
                  }
                };
              } catch (error) {
                console.warn(`[SessionSocket] Failed to parse transcript for stale session ${sessionId}:`, error);
                audioData.transcript_summary = fullTranscript.substring(0, 500);
              }
            }
          }

          await createDraftConnection(
            audioData,
            sessionSnapshot.visual,
            sessionSnapshot.context,
            sessionSnapshot.userId,
            false
          );

          // Clean up socket reference for stale session
          sessionSocketMap.delete(sessionId);

          console.log(`[SessionSocket] Auto-finalized stale session ${sessionId}`);
        } catch (error) {
          console.error(`[SessionSocket] Error auto-finalizing stale session ${sessionId}:`, error);
        }
      });
    }
  }, 60 * 1000); // Check every minute
};

