import SessionManager from './SessionManager.js';
import { createLiveTranscriptionConnection, LiveTranscriptionEvents } from '../controllers/transcribeController.js';
import { parseVisualData } from '../services/visualParser.js';
import { parseTranscript } from '../services/transcriptParser.js';
import { createDraftConnection, addInteractionToExistingConnection } from '../services/processingService.js';
import { findMatchingConnection } from '../services/faceMatching.js';
import * as logger from '../utils/sessionLogger.js';
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

      logger.logDeepgramConnection(currentSessionId, 'starting', { message: 'Initializing Deepgram connection...' });

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
        logger.logError(currentSessionId, 'Deepgram connection creation', error);
        logger.logDeepgramConnection(currentSessionId, 'error', { message: error.message });
        socket.emit('session:error', { message: `Deepgram error: ${error.message}` });
        return;
      }

      deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        logger.logDeepgramConnection(currentSessionId, 'opened', { message: 'Connection ready' });
        deepgramReady = true;
        
        // Flush queued audio chunks now that connection is ready
        if (audioQueue.length > 0) {
          console.log(`  Flushing ${audioQueue.length} queued audio chunks`);
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

        if (!transcript) return;

        // Extract timing info from words array for speaker correlation
        const firstWord = words[0];
        const lastWord = words[words.length - 1];
        const timing = (firstWord && lastWord && firstWord.speaker !== undefined) ? {
          speakerId: firstWord.speaker,
          startTime: firstWord.start,
          endTime: lastWord.end
        } : null;

        // Feed transcript to LiveInsightEngine with timing info
        if (insightEngine) {
          insightEngine.addTranscript(transcript, data.is_final, timing);
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
          logger.logError(currentSessionId, 'Audio update', error);
          socket.emit('session:error', { message: error.message });
        }
      });

      deepgramConnection.on(LiveTranscriptionEvents.Error, (error) => {
        logger.logError(currentSessionId, 'Deepgram error', error);
        logger.logDeepgramConnection(currentSessionId, 'error', { message: error?.message || 'Unknown error' });
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

        if (insightEngine) {
          insightEngine.cleanup();
          insightEngine = null;
        }

        // Create session in SessionManager
        SessionManager.createSession(sessionId, userId, context || {});
        currentSessionId = sessionId;
        insightEngine = new LiveInsightEngine(sessionId, socket);

        // Store socket reference for cross-module communication
        sessionSocketMap.set(sessionId, socket);

        // Emit ready event
        socket.emit('session:ready', {
          sessionId,
          message: 'Session initialized'
        });
      } catch (error) {
        logger.logError(sessionId, 'Session start', error);
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

        // Log raw visual data received
        console.log(`\n📥 Raw visual data received for session ${currentSessionId}`);
        console.log(`  Data keys: ${Object.keys(data).join(', ')}`);
        
        // Check if this is an Overshoot result and parse it
        if (data.result) {
          let parsedResult = null;
          try {
            parsedResult = typeof data.result === 'string' 
              ? JSON.parse(data.result) 
              : data.result;
            
            console.log(`  📋 Parsed Overshoot Result:`);
            console.log(`    face_detected: ${parsedResult.face_detected}`);
            console.log(`    is_speaking: ${parsedResult.is_speaking ? '🗣️ YES' : '🤐 NO'}`);
            console.log(`    appearance_profile: ${parsedResult.appearance_profile ? 'Present' : 'Missing'}`);
            console.log(`    environment_context: ${parsedResult.environment_context ? 'Present' : 'Missing'}`);
            
            // Update LiveInsightEngine with visual speaking state for speaker correlation
            if (insightEngine && data.captureTime !== undefined && data.captureTime !== null) {
              const isSpeaking = parsedResult.is_speaking === true;
              insightEngine.updateVisualState(data.captureTime, isSpeaking);
              
              // Log correlation status
              const status = insightEngine.getCorrelationStatus();
              if (status.correlated !== null) {
                console.log(`  [Correlation] Target: S${status.correlated} | ${status.scores} | Events: ${status.visualEvents}`);
              }
            }
          } catch (e) {
            console.log(`  ⚠️ Could not parse result as JSON`);
          }
        }
        
        if (data.headshot) {
          console.log(`  Headshot: ${data.headshot.url ? 'URL present' : ''} ${data.headshot.base64 ? 'Base64 present' : ''}`);
        }
        if (data.face_embedding) {
          console.log(`  Face embedding: ${data.face_embedding.length} dimensions`);
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

        // Perform face matching immediately if we have a face embedding
        if (parsedVisual.face_embedding && parsedVisual.face_embedding.length === 128) {
          logger.logFaceMatchingStarted(
            currentSessionId, 
            true, 
            parsedVisual.face_embedding.length
          );
          try {
            const userId = session.userId;
            const matches = await findMatchingConnection(userId, parsedVisual.face_embedding);
            
            logger.logFaceMatchResult(
              currentSessionId,
              matches.length > 0 && matches[0].score >= 0.80,
              matches.length > 0 ? {
                name: matches[0].connection.name?.value || matches[0].connection.name || 'Unknown',
                connectionId: matches[0].connection._id.toString(),
                score: matches[0].score
              } : null,
              matches
            );
            
            if (matches.length > 0 && matches[0].score >= 0.80) {
              // Match found - update session with match results
              const bestMatch = matches[0];
              SessionManager.updateFaceMatch(currentSessionId, {
                matched: true,
                connectionId: bestMatch.connection._id.toString(),
                name: bestMatch.connection.name?.value || 'Unknown',
                connectionData: {
                  company: bestMatch.connection.company?.value || null,
                  visual: bestMatch.connection.visual,
                  score: bestMatch.score
                }
              });

              // Emit face match result to client
              socket.emit('face_match_result', {
                matched: true,
                name: bestMatch.connection.name?.value || 'Unknown',
                company: bestMatch.connection.company?.value || null,
                profileImage: bestMatch.connection.visual?.headshot?.url || null,
                insights: [
                  { type: 'bullet', text: `Name: ${bestMatch.connection.name?.value || 'Unknown'}` },
                  { type: 'bullet', text: `Company: ${bestMatch.connection.company?.value || 'Unknown'}` },
                  { type: 'bullet', text: `Match confidence: ${Math.round(bestMatch.score * 100)}%` },
                  { type: 'bullet', text: 'Previous connection found' }
                ]
              });
            } else {
              // No match found - new person (already logged above)
              SessionManager.updateFaceMatch(currentSessionId, {
                matched: false,
                connectionId: null,
                name: null,
                connectionData: null
              });

              // Emit new contact result to client
              socket.emit('face_match_result', {
                matched: false,
                name: 'New Contact',
                company: null,
                profileImage: null,
                insights: [
                  { type: 'bullet', text: 'New person detected' },
                  { type: 'bullet', text: 'No previous connection found' },
                  { type: 'bullet', text: 'Professional networking context' },
                  { type: 'bullet', text: 'Ready to save new connection' }
                ]
              });
            }
          } catch (error) {
            logger.logError(currentSessionId, 'Face matching', error);
            // Don't fail the whole visual update if face matching fails
            SessionManager.updateFaceMatch(currentSessionId, {
              matched: false,
              connectionId: null,
              name: null,
              connectionData: null
            });
          }
        } else {
          // No face embedding available
          logger.logFaceMatchingStarted(currentSessionId, false, 0);
        }

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
          logger.logAudioChunkReceived(currentSessionId, audioChunkCount, buffer.length);
          
          // Queue chunks until connection is ready, then send directly
          if (deepgramReady && deepgramConnection) {
            deepgramConnection.send(buffer);
          } else {
            audioQueue.push(buffer);
          }
        }
      } catch (error) {
        logger.logError(currentSessionId, 'Audio chunk processing', error);
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

        // Log final correlation status before cleanup
        if (insightEngine) {
          const status = insightEngine.getCorrelationStatus();
          console.log(`[Session End] Correlation: ${status.correlated !== null ? `S${status.correlated}` : 'none'} | ${status.scores}`);
        }

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
              logger.logTranscriptParsing(currentSessionId, fullTranscript.length);
              // Parse transcript to extract profile data
              const parsed = await parseTranscript(fullTranscript);
              
              logger.logProfileExtracted(currentSessionId, parsed);
              
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
              logger.logError(currentSessionId, 'Transcript parsing', error);
              audioData.transcript_summary = fullTranscript.substring(0, 500); // Truncate if too long
            }
          }
        }

        // Check if we have a face match from headshot generation
        const faceMatch = sessionSnapshot.visual.faceMatch;
        let finalConnection;
        let actionType;

        if (faceMatch?.matched && faceMatch.connectionId) {
          // UPDATE EXISTING CONNECTION
          logger.logConnectionDecision(currentSessionId, 'updated', {
            connectionId: faceMatch.connectionId,
            name: faceMatch.name,
            matchScore: faceMatch.connectionData?.score
          });
          
          try {
            finalConnection = await addInteractionToExistingConnection(
              faceMatch.connectionId,
              audioData,
              sessionSnapshot.visual,
              sessionSnapshot.context,
              sessionSnapshot.userId
            );

            actionType = 'updated';
          } catch (error) {
            logger.logError(currentSessionId, 'Update existing connection', error);
            // Fallback to creating new connection if update fails
            logger.logConnectionDecision(currentSessionId, 'created', {
              reason: 'Update failed, falling back to create new'
            });
            finalConnection = await createDraftConnection(
              audioData,
              sessionSnapshot.visual,
              sessionSnapshot.context,
              sessionSnapshot.userId,
              false // Not temporary
            );
            actionType = 'created';
          }
        } else {
          // CREATE NEW CONNECTION
          logger.logConnectionDecision(currentSessionId, 'created', {
            reason: 'No face match found'
          });
          
          finalConnection = await createDraftConnection(
            audioData,
            sessionSnapshot.visual,
            sessionSnapshot.context,
            sessionSnapshot.userId,
            false // Not temporary
          );

          actionType = 'created';
        }

        // Emit finalized event with connection details
        socket.emit('session:finalized', {
          connectionId: finalConnection._id.toString(),
          profile: {
            name: finalConnection.name.value,
            company: finalConnection.company.value,
            status: finalConnection.status
          },
          action: actionType, // 'updated' or 'created'
          message: actionType === 'updated' 
            ? `Session finalized and added to existing connection: ${finalConnection.name.value}`
            : 'Session finalized and saved to database'
        });

        logger.logSessionFinalized(
          currentSessionId,
          finalConnection._id.toString(),
          actionType,
          {
            name: finalConnection.name.value,
            company: finalConnection.company.value
          }
        );

        // Clean up socket reference
        sessionSocketMap.delete(currentSessionId);
        currentSessionId = null;
      } catch (error) {
        logger.logError(currentSessionId, 'Session finalization', error);
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
                logger.logTranscriptParsing(sessionId, fullTranscript.length);
                const parsed = await parseTranscript(fullTranscript);
                logger.logProfileExtracted(sessionId, parsed);
                audioData = {
                  ...parsed,
                  profile: {
                    name: parsed.profile.name?.confidence === 'high' ? parsed.profile.name : audioData.profile.name,
                    company: parsed.profile.company?.confidence === 'high' ? parsed.profile.company : audioData.profile.company,
                    role: parsed.profile.role?.confidence === 'high' ? parsed.profile.role : audioData.profile.role
                  }
                };
              } catch (error) {
                logger.logError(sessionId, 'Transcript parsing (stale session)', error);
                audioData.transcript_summary = fullTranscript.substring(0, 500);
              }
            }
          }

          // Check if we have a face match from headshot generation
          const faceMatch = sessionSnapshot.visual.faceMatch;
          let finalConnection;
          let actionType;

          if (faceMatch?.matched && faceMatch.connectionId) {
            // UPDATE EXISTING CONNECTION
            logger.logConnectionDecision(sessionId, 'updated', {
              connectionId: faceMatch.connectionId,
              name: faceMatch.name,
              matchScore: faceMatch.connectionData?.score
            });
            
            try {
              finalConnection = await addInteractionToExistingConnection(
                faceMatch.connectionId,
                audioData,
                sessionSnapshot.visual,
                sessionSnapshot.context,
                sessionSnapshot.userId
              );

              actionType = 'updated';
            } catch (error) {
              logger.logError(sessionId, 'Update existing connection (stale session)', error);
              // Fallback to creating new connection if update fails
              logger.logConnectionDecision(sessionId, 'created', {
                reason: 'Update failed, falling back to create new'
              });
              finalConnection = await createDraftConnection(
                audioData,
                sessionSnapshot.visual,
                sessionSnapshot.context,
                sessionSnapshot.userId,
                false
              );
              actionType = 'created';
            }
          } else {
            // CREATE NEW CONNECTION
            logger.logConnectionDecision(sessionId, 'created', {
              reason: 'No face match found'
            });
            
            finalConnection = await createDraftConnection(
              audioData,
              sessionSnapshot.visual,
              sessionSnapshot.context,
              sessionSnapshot.userId,
              false
            );

            actionType = 'created';
          }
          
          logger.logSessionFinalized(
            sessionId,
            finalConnection._id.toString(),
            actionType,
            {
              name: finalConnection.name.value,
              company: finalConnection.company.value
            }
          );

          // Clean up socket reference for stale session
          sessionSocketMap.delete(sessionId);
        } catch (error) {
          logger.logError(sessionId, 'Auto-finalize stale session', error);
        }
      });
    }
  }, 60 * 1000); // Check every minute
};





