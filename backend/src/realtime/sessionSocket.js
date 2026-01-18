import SessionManager from './SessionManager.js';
import { createLiveTranscriptionConnection, LiveTranscriptionEvents } from '../controllers/transcribeController.js';
import { parseVisualData } from '../services/visualParser.js';
import { parseTranscript } from '../services/transcriptParser.js';
import { createDraftConnection, addInteractionToExistingConnection } from '../services/processingService.js';
import { findMatchingConnection } from '../services/faceMatching.js';

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
          encoding: 'opus',  // Required for WebM/Opus streams - Deepgram can't auto-detect in live mode
          ...options
        });
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
        console.error(`[SessionSocket] Deepgram error:`, error);
        socket.emit('session:error', {
          message: `Deepgram error: ${error?.message || 'Unknown error'}`,
          details: error
        });
      });

      deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log(`[SessionSocket] Deepgram connection closed for session ${currentSessionId}`);
        closeDeepgramConnection();
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

        // Perform face matching immediately if we have a face embedding
        if (parsedVisual.face_embedding && parsedVisual.face_embedding.length === 128) {
          try {
            const userId = session.userId;
            const matches = await findMatchingConnection(userId, parsedVisual.face_embedding);
            
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

              console.log(`[SessionSocket] Face match found during visual update: ${bestMatch.connection.name?.value} (score: ${bestMatch.score})`);
            } else {
              // No match found - new person
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

              console.log(`[SessionSocket] No face match found during visual update - new person`);
            }
          } catch (error) {
            console.error('[SessionSocket] Error during face matching in visual update:', error);
            // Don't fail the whole visual update if face matching fails
            SessionManager.updateFaceMatch(currentSessionId, {
              matched: false,
              connectionId: null,
              name: null,
              connectionData: null
            });
          }
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

        // Get session snapshot
        const sessionSnapshot = SessionManager.finalizeSession(currentSessionId);

        // Parse final transcript if we have chunks
        let audioData = {
          profile: sessionSnapshot.audio.profile,
          topics_discussed: sessionSnapshot.audio.topics_discussed,
          their_challenges: sessionSnapshot.audio.their_challenges,
          follow_up_hooks: sessionSnapshot.audio.follow_up_hooks,
          personal_details: sessionSnapshot.audio.personal_details,
          transcript_summary: sessionSnapshot.audio.transcript_summary
        };

        // If we have transcript chunks but no summary, parse the full transcript
        if (sessionSnapshot.audio.transcript_chunks.length > 0 && !audioData.transcript_summary) {
          const fullTranscript = sessionSnapshot.audio.transcript_chunks
            .map(chunk => chunk.transcript)
            .join(' ')
            .trim();

          if (fullTranscript) {
            try {
              // Parse transcript to extract profile data
              const parsed = await parseTranscript(fullTranscript);
              
              // Merge parsed data with existing audio data
              audioData = {
                ...parsed,
                // Keep existing profile if parsed has lower confidence
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

        // Check if we have a face match from headshot generation
        const faceMatch = sessionSnapshot.visual.faceMatch;
        let finalConnection;
        let actionType;

        if (faceMatch?.matched && faceMatch.connectionId) {
          // UPDATE EXISTING CONNECTION
          console.log(`[SessionSocket] Face match found: ${faceMatch.name} (Connection ID: ${faceMatch.connectionId})`);
          
          try {
            finalConnection = await addInteractionToExistingConnection(
              faceMatch.connectionId,
              audioData,
              sessionSnapshot.visual,
              sessionSnapshot.context,
              sessionSnapshot.userId
            );

            actionType = 'updated';
            console.log(`[SessionSocket] Updated existing connection ${finalConnection._id} for session ${currentSessionId}`);
          } catch (error) {
            console.error(`[SessionSocket] Error updating existing connection ${faceMatch.connectionId}:`, error);
            // Fallback to creating new connection if update fails
            console.log(`[SessionSocket] Falling back to creating new connection`);
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
          console.log(`[SessionSocket] No face match found, creating new draft connection`);
          
          finalConnection = await createDraftConnection(
            audioData,
            sessionSnapshot.visual,
            sessionSnapshot.context,
            sessionSnapshot.userId,
            false // Not temporary
          );

          actionType = 'created';
          console.log(`[SessionSocket] Created new draft connection ${finalConnection._id} for session ${currentSessionId}`);
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

          // Check if we have a face match from headshot generation
          const faceMatch = sessionSnapshot.visual.faceMatch;
          let finalConnection;
          let actionType;

          if (faceMatch?.matched && faceMatch.connectionId) {
            // UPDATE EXISTING CONNECTION
            console.log(`[SessionSocket] Stale session ${sessionId}: Face match found: ${faceMatch.name} (Connection ID: ${faceMatch.connectionId})`);
            
            try {
              finalConnection = await addInteractionToExistingConnection(
                faceMatch.connectionId,
                audioData,
                sessionSnapshot.visual,
                sessionSnapshot.context,
                sessionSnapshot.userId
              );

              actionType = 'updated';
              console.log(`[SessionSocket] Auto-finalized stale session ${sessionId}: Updated existing connection ${finalConnection._id}`);
            } catch (error) {
              console.error(`[SessionSocket] Error updating existing connection for stale session ${sessionId}:`, error);
              // Fallback to creating new connection if update fails
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
            finalConnection = await createDraftConnection(
              audioData,
              sessionSnapshot.visual,
              sessionSnapshot.context,
              sessionSnapshot.userId,
              false
            );

            actionType = 'created';
            console.log(`[SessionSocket] Auto-finalized stale session ${sessionId}: Created new draft connection ${finalConnection._id}`);
          }

          // Clean up socket reference for stale session
          sessionSocketMap.delete(sessionId);
        } catch (error) {
          console.error(`[SessionSocket] Error auto-finalizing stale session ${sessionId}:`, error);
        }
      });
    }
  }, 60 * 1000); // Check every minute
};

