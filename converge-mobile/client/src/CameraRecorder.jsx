import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RealtimeVision } from '@overshoot/sdk';
import { io } from 'socket.io-client';
import { logoutFromAPI, getUser } from './authUtils';
import './CameraRecorder.css';

function CameraRecorder() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [screenshotBuffer, setScreenshotBuffer] = useState([]);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('idle'); // idle, ready, recording, finalized
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState(null);
  const [showInsightsOverlay, setShowInsightsOverlay] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  
  // Insights overlay data - supports bullet points
  // Updated dynamically when face_match_result is received from backend
  const [insightsData, setInsightsData] = useState({
    items: []
  });
  const visionRef = useRef(null);

  // Helper function to update insights data dynamically
  // Example: updateInsights({ items: [...] })
  const updateInsights = (newData) => {
    setInsightsData(prev => ({
      ...prev,
      ...newData
    }));
  };
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const sessionSocketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const headshotRequestInFlightRef = useRef(false);
  const headshotGeneratedRef = useRef(false);
  const currentSessionIdRef = useRef(null); // Keep track of current session ID for headshot generation

  const handleLogout = async () => {
    await logoutFromAPI();
    navigate('/');
  };

  // Capture current frame from video element
  const captureVideoFrame = (videoElement) => {
    if (!videoElement || videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      // Downscale resolution to 640px wide to significantly reduce size
      const maxWidth = 640;
      const scale = Math.min(1, maxWidth / videoElement.videoWidth);
      canvas.width = videoElement.videoWidth * scale;
      canvas.height = videoElement.videoHeight * scale;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Use image/jpeg with 0.7 quality for much better compression than PNG
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.7);
      return imageDataUrl;
    } catch (error) {
      console.error('Error capturing video frame:', error);
      return null;
    }
  };

  // Helper function to stop camera and vision SDK
  const stopCamera = async () => {
    try {
      // Stop audio recording
      stopAudioRecording();
      
      // Stop Overshoot SDK
      if (visionRef.current) {
        await visionRef.current.stop();
        visionRef.current = null;
      }
      
      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Clear video preview
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setIsRunning(false);
      setScreenshotBuffer([]); // Clear buffer
    } catch (error) {
      console.error('Error stopping camera:', error);
    }
  };

  // Start audio recording using session socket for transcription
  const startAudioRecording = async (mediaStream) => {
    try {
      console.log('🎤 Starting audio recording via session socket');
      
      // Extract only audio tracks (MediaRecorder with audio mime type can't have video tracks)
      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.error('No audio tracks found in stream');
        return;
      }
      const audioOnlyStream = new MediaStream(audioTracks);
      
      // Create MediaRecorder to capture audio chunks
      const mediaRecorder = new MediaRecorder(audioOnlyStream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && sessionSocketRef.current && sessionSocketRef.current.connected) {
          // Convert blob to array buffer and send via session socket
          event.data.arrayBuffer().then(buffer => {
            if (sessionSocketRef.current && sessionSocketRef.current.connected) {
              sessionSocketRef.current.emit('session:audio', buffer);
            }
          });
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;

      // Start recording immediately (250ms chunks for live streaming)
      mediaRecorder.start(250);
      setIsRecording(true);
      
      setResults(prev => [...prev, {
        text: '🎤 Live transcription started via session socket',
        timestamp: new Date().toLocaleTimeString(),
        inferenceLatency: null,
        totalLatency: null
      }]);

    } catch (error) {
      console.error('Error starting audio recording:', error);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
      
      setResults(prev => [...prev, {
        text: '⏹️ Live transcription stopped',
        timestamp: new Date().toLocaleTimeString(),
        inferenceLatency: null,
        totalLatency: null
      }]);
    }
  };

  // Send screenshots to Gemini API via server
  const sendScreenshotsToGemini = async (screenshots) => {
    // Don't send if we already have a generated headshot
    if (generatedImage || headshotGeneratedRef.current || headshotRequestInFlightRef.current) {
      console.log('Headshot already generated, skipping...');
      return;
    }
    headshotGeneratedRef.current = true;
    headshotRequestInFlightRef.current = true;
    
    // Generate headshot in the background while streams continue
    setResults(prev => [...prev, {
      text: '🧠 Generating headshot in background...',
      timestamp: new Date().toLocaleTimeString(),
      inferenceLatency: null,
      totalLatency: null
    }]);
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-headshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          screenshots,
          sessionId: currentSessionIdRef.current 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate headshot');
      }

      const result = await response.json();
      
      if (result.image) {
        setGeneratedImage(result.image);
        setResults(prev => [...prev, {
          text: '✅ Headshot generated successfully!',
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
        
        // Camera is already stopped, just confirm completion
        setResults(prev => [...prev, {
          text: '✅ Headshot generation complete!',
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      } else if (result.text) {
        setResults(prev => [...prev, {
          text: `Gemini response: ${result.text}`,
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      }
    } catch (error) {
      console.error('Error sending screenshots to Gemini:', error);
      setResults(prev => [...prev, {
        text: `❌ Error generating headshot: ${error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        inferenceLatency: null,
        totalLatency: null
      }]);
    } finally {
      setIsGenerating(false);
      headshotRequestInFlightRef.current = false;
    }
  };

  // Generate unique session ID
  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleStart = async () => {
    // Immediately hide the placeholder when user clicks start
    setIsRunning(true);
    
    try {
      // Reset per-session headshot state
      headshotGeneratedRef.current = false;
      headshotRequestInFlightRef.current = false;
      setGeneratedImage(null);

      // Generate session ID
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      currentSessionIdRef.current = newSessionId; // Store in ref for headshot generation
      setSessionStatus('ready');

      // Connect to session WebSocket
      const sessionSocket = io('http://localhost:3001/api/session', {
        transports: ['websocket']
      });
      sessionSocketRef.current = sessionSocket;

      // Setup session event listeners
      sessionSocket.on('session:ready', () => {
        setSessionStatus('recording');
        setResults(prev => [...prev, {
          text: '✅ Session initialized',
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      });

      sessionSocket.on('session:visual_update', (data) => {
        setResults(prev => [...prev, {
          text: `📸 Visual intel locked: ${data.visual.appearance || 'Face detected'}`,
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      });

      sessionSocket.on('session:audio_update', (data) => {
        if (data.transcript_chunk) {
          // Update accumulated transcript for display
          const speakerPrefix = data.speaker !== undefined ? `[Speaker ${data.speaker}] ` : '';
          if (data.is_final) {
            setAudioTranscript(prev => ({
              text: (prev?.text || '') + ' ' + speakerPrefix + data.transcript_chunk,
              timestamp: new Date().toLocaleTimeString()
            }));
          }
          setResults(prev => [...prev, {
            text: `💬 ${speakerPrefix}${data.transcript_chunk}`,
            timestamp: new Date().toLocaleTimeString(),
            inferenceLatency: null,
            totalLatency: null
          }]);
        }
      });

      // Listen for face match results
      sessionSocket.on('face_match_result', (data) => {
        console.log('🎯 Face match result received:', data);
        
        // Update insights overlay with received data
        if (data && data.insights) {
          setInsightsData({ items: data.insights });
          setProfileImage(data.profileImage || null);
          setShowInsightsOverlay(true);
        }
        
        setResults(prev => [...prev, {
          text: `🎯 Face match: ${data.matched ? data.name : 'New contact detected'}`,
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      });

      sessionSocket.on('session:finalized', (data) => {
        setSessionStatus('finalized');
        setResults(prev => [...prev, {
          text: `✅ Session finalized! Connection ID: ${data.connectionId}`,
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      });

      sessionSocket.on('session:error', (error) => {
        setResults(prev => [...prev, {
          text: `❌ Session error: ${error.message}`,
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      });

      // Start session with context
      // Get authenticated user
      const user = getUser();
      const userId = user?.id || user?._id;
      if (!user || !userId) {
        console.error('No authenticated user found');
        navigate('/');
        return;
      }

      sessionSocket.emit('session:start', {
        sessionId: newSessionId,
        userId: userId, // Get from authenticated user
        context: {
          event: { name: 'NexHacks 2026', type: 'hackathon' },
          location: { name: 'Test Location', city: 'San Francisco' }
        }
      });

      // Get camera and microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      // Show video preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      streamRef.current = stream;

      // Start audio recording via session socket (single socket for everything)
      await startAudioRecording(stream);

      // Initialize Overshoot SDK
      const vision = new RealtimeVision({
        apiUrl: 'https://cluster1.overshoot.ai/api/v0.2',
        apiKey: (process.env.REACT_APP_OVERSHOOT_API_KEY || 'your-api-key').replace(/^["']|["']$/g, ''),
        prompt: `Analyze the current frame.
           1. First, determine if a human face is clearly visible. Set "face_detected" to true or false.
           2. If true, generate a compact "appearance_profile" merging clothing, style, and facial features (e.g., "Silver blazer, graphic tee, scar on left eyebrow, square glasses").
           3. If true, briefly describe the "environment_context" (e.g., "Noisy VIP lounge").
           4. If false, leave the profile and context as empty strings.`,
        outputSchema: {
            type: "object",
            properties: {
              face_detected: {
                type: "boolean",
                description: "True if a human face is clearly visible in the frame, otherwise false."
              },
              appearance_profile: { 
                type: "string", 
                description: "A compact fusion of clothing, accessories, and key facial features. Empty if no face detected." 
              },
              environment_context: { 
                type: "string", 
                description: "Brief context of the surroundings. Empty if no face detected." 
              }
            },
            required: ["face_detected", "appearance_profile", "environment_context"]
          },
        source: { type: 'camera', cameraFacing: 'environment' },
        processing: {
            clip_length_seconds: 1,
            delay_seconds: 1,
            fps: 30,
            sampling_ratio: 0.1
          },
        onResult: (result) => {
          // Send visual data to session WebSocket
          if (sessionSocketRef.current && sessionSocketRef.current.connected) {
            sessionSocketRef.current.emit('session:visual', result);
          }
          
          // Parse the result - it should match the outputSchema structure
          const parsedResult = typeof result.result === 'string' 
            ? JSON.parse(result.result) 
            : result.result;
          
          // Check if face is detected and capture screenshot
          // Stop collecting if we already have a generated headshot
          if (
            parsedResult &&
            parsedResult.face_detected === true &&
            !generatedImage &&
            !isGenerating &&
            !headshotRequestInFlightRef.current &&
            !headshotGeneratedRef.current
          ) {
            const screenshotDataUrl = captureVideoFrame(videoRef.current);
            if (screenshotDataUrl) {
              // Add screenshot capture notification to results
              setResults(prev => [...prev, {
                text: '📸 Screenshot captured - Face detected',
                timestamp: new Date().toLocaleTimeString(),
                inferenceLatency: result.inference_latency_ms,
                totalLatency: result.total_latency_ms
              }]);

              // Add to buffer
              setScreenshotBuffer(prev => {
                const newBuffer = [...prev, screenshotDataUrl];
                
                // If we have 2 screenshots, send to Gemini
                if (newBuffer.length >= 2) {
                  setResults(prevResults => [...prevResults, {
                    text: '🔄 Sending 2 screenshots to Gemini for headshot generation...',
                    timestamp: new Date().toLocaleTimeString(),
                    inferenceLatency: null,
                    totalLatency: null
                  }]);
                  sendScreenshotsToGemini(newBuffer.slice(0, 2));
                  return []; // Clear buffer after sending
                }
                
                return newBuffer;
              });
            }
          }
          
          setResults(prev => [...prev, {
            text: result.result,
            timestamp: new Date().toLocaleTimeString(),
            inferenceLatency: result.inference_latency_ms,
            totalLatency: result.total_latency_ms
          }]);
        }
      });

      visionRef.current = vision;
      await vision.start();
    } catch (error) {
      console.error('Error starting vision:', error);
      setIsRunning(false); // Reset on error
      alert('Failed to start camera. Please check your API key and permissions.');
    }
  };

  const handleStop = async () => {
    try {
      // Stop audio recording first
      stopAudioRecording();
      
      // End session
      if (sessionSocketRef.current && sessionSocketRef.current.connected) {
        sessionSocketRef.current.emit('session:end');
        setResults(prev => [...prev, {
          text: '🛑 Ending session and finalizing...',
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      }

      // Stop Overshoot SDK
      if (visionRef.current) {
        await visionRef.current.stop();
        visionRef.current = null;
      }
      
      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Clear video preview
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      // Disconnect session socket
      if (sessionSocketRef.current) {
        sessionSocketRef.current.disconnect();
        sessionSocketRef.current = null;
      }
      
      // Clear session ID ref
      currentSessionIdRef.current = null;
      
      setIsRunning(false);
      setSessionId(null);
      setSessionStatus('idle');
      
      // Reset insights overlay for next session
      setShowInsightsOverlay(false);
      setInsightsData({ items: [] });
      setProfileImage(null);
    } catch (error) {
      console.error('Error stopping vision:', error);
    }
  };

  const handleUpdatePrompt = (newPrompt) => {
    if (visionRef.current) {
      visionRef.current.updatePrompt(newPrompt);
    }
  };

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      // Clean up video stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Clean up session socket
      if (sessionSocketRef.current) {
        sessionSocketRef.current.disconnect();
      }
      // Clean up audio recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="CameraRecorder">
      {/* Logout button overlay */}
      <button
        onClick={handleLogout}
        className="logout-button"
        title="Logout"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>

      <div className="app-container">
        {/* Minimal Header */}
        <header className="app-header-minimal">
          <h1 className="app-title">Converge</h1>
        </header>
        
        {/* Camera Preview */}
        <div className="camera-container">
          <div className="camera-preview">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="video-preview"
            />
            {!isRunning && (
              <div className="video-placeholder">
                <div className="placeholder-icon">📸</div>
                <p>Camera preview will appear here</p>
              </div>
            )}

            {/* Mobile Insights Overlay - Top-aligned, scrollable */}
            {isRunning && showInsightsOverlay && insightsData.items.length > 0 && (
              <div className="insights-overlay">
                <div className="insights-overlay-content">
                  <h3 className="insights-header">Converge</h3>
                  <div className="insights-body">
                    <ul className="insights-list">
                      {insightsData.items.map((item, index) => (
                        <li key={index} className="insight-item">
                          {item.type === 'bullet' && <span className="bullet-dot">•</span>}
                          <span className="insight-text">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                    {profileImage && (
                      <div className="profile-image-container">
                        <img 
                          src={profileImage} 
                          alt="Profile" 
                          className="profile-image"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Show insights button when hidden */}
            {isRunning && !showInsightsOverlay && (
              <button 
                className="insights-show-btn"
                onClick={() => setShowInsightsOverlay(true)}
                aria-label="Show insights"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Control Button */}
        <div className="controls-container">
          {!isRunning ? (
            <button onClick={handleStart} className="control-btn control-btn-start">
              <div className="btn-icon">▶</div>
              <span>Start Recording</span>
            </button>
          ) : (
            <button onClick={handleStop} className="control-btn control-btn-stop">
              <div className="btn-icon">■</div>
              <span>Stop Recording</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CameraRecorder;

