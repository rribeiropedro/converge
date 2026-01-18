import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RealtimeVision } from '@overshoot/sdk';
import { io } from 'socket.io-client';
import { logoutFromAPI } from './authUtils';
import './App.css';

function App() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [screenshotBuffer, setScreenshotBuffer] = useState([]);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState(null);
  const visionRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const audioStreamRef = useRef(null);

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

  // Live audio transcription with WebSocket
  const startAudioRecording = async () => {
    try {
      console.log('🔌 Connecting to WebSocket at /api/transcribe/live');
      
      // Connect to WebSocket
      const socket = io('/api/transcribe/live', {
        transports: ['websocket', 'polling']
      });
      socketRef.current = socket;

      // Connection event listeners
      socket.on('connect', () => {
        console.log('✅ WebSocket connected, ID:', socket.id);
        setResults(prev => [...prev, {
          text: '🔌 WebSocket connected',
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket disconnected:', reason);
        setResults(prev => [...prev, {
          text: `🔌 WebSocket disconnected: ${reason}`,
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        setResults(prev => [...prev, {
          text: `❌ Connection error: ${error.message}`,
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      });

      // Start audio stream first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      audioStreamRef.current = stream;

      // Create MediaRecorder to capture audio chunks
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current) {
          // Convert blob to array buffer and send via socket
          event.data.arrayBuffer().then(buffer => {
            if (socketRef.current && socketRef.current.connected) {
              console.log(`🎵 Sending audio chunk: ${buffer.byteLength} bytes`);
              socketRef.current.emit('audio', buffer);
            }
          });
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;

      // Set up socket event listeners
      socket.on('ready', () => {
        console.log('✅ WebSocket ready for audio streaming - Starting MediaRecorder');
        setResults(prev => [...prev, {
          text: '🎤 Live transcription ready - Recording started',
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);

        // Start recording only after WebSocket is ready (250ms chunks for live streaming)
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.start(250);
          setIsRecording(true);
        }
      });

      socket.on('transcript', (data) => {
        console.log('📝 Transcript received:', data);
        if (data.is_final) {
          const speakerPrefix = data.speaker !== undefined ? `[Speaker ${data.speaker}] ` : '';
          setAudioTranscript(prev => ({
            text: (prev?.text || '') + ' ' + speakerPrefix + data.transcript,
            timestamp: new Date().toLocaleTimeString()
          }));
          setResults(prev => [...prev, {
            text: `💬 ${speakerPrefix}${data.transcript}`,
            timestamp: new Date().toLocaleTimeString(),
            inferenceLatency: null,
            totalLatency: null
          }]);
        }
      });

      socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        setResults(prev => [...prev, {
          text: `❌ Transcription error: ${error.message}`,
          timestamp: new Date().toLocaleTimeString(),
          inferenceLatency: null,
          totalLatency: null
        }]);
      });

      socket.on('closed', () => {
        console.log('WebSocket closed');
      });

      setResults(prev => [...prev, {
        text: '🎤 Initializing live transcription...',
        timestamp: new Date().toLocaleTimeString(),
        inferenceLatency: null,
        totalLatency: null
      }]);

      // Send start event to backend FIRST - recording will start when 'ready' event is received
      console.log('📤 Sending start event to backend');
      socket.emit('start', {
        language: 'en',
        model: 'nova-3',
        smart_format: true,
        diarize: true,
        interim_results: true,
        encoding: 'opus',
        sample_rate: 16000
      });

    } catch (error) {
      console.error('Error starting audio recording:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop audio stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }

      // Close WebSocket connection
      if (socketRef.current) {
        socketRef.current.emit('stop');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
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
    if (generatedImage) {
      console.log('Headshot already generated, skipping...');
      return;
    }
    
    // Stop camera immediately after collecting 2 screenshots
    await stopCamera();
    setResults(prev => [...prev, {
      text: '🛑 Camera stopped - Processing screenshots...',
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
        body: JSON.stringify({ screenshots })
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
    }
  };

  const handleStart = async () => {
    try {
      // Get camera stream for preview
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      // Show video preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      streamRef.current = stream;

      // Start audio recording alongside video
      await startAudioRecording();

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
          // Send result to server for terminal logging
          fetch('/api/overshoot-result', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(result)
          }).catch(err => {
            console.warn('Failed to send result to server:', err);
          });
          
          // Parse the result - it should match the outputSchema structure
          const parsedResult = typeof result.result === 'string' 
            ? JSON.parse(result.result) 
            : result.result;
          
          // Check if face is detected and capture screenshot
          // Stop collecting if we already have a generated headshot
          if (parsedResult && parsedResult.face_detected === true && !generatedImage) {
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
      setIsRunning(true);
    } catch (error) {
      console.error('Error starting vision:', error);
      alert('Failed to start camera. Please check your API key and permissions.');
    }
  };

  const handleStop = async () => {
    try {
      // Stop audio recording first
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
    } catch (error) {
      console.error('Error stopping vision:', error);
    }
  };

  const handleUpdatePrompt = (newPrompt) => {
    if (visionRef.current) {
      visionRef.current.updatePrompt(newPrompt);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up video stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Clean up audio recording
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      // Clean up audio stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      // Clean up WebSocket
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isRecording]);

  return (
    <div className="App">
      {/* Logout button overlay */}
      <button
        onClick={handleLogout}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          zIndex: 9999,
          padding: '0.5rem 1rem',
          background: 'rgba(220, 38, 38, 0.9)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(220, 38, 38, 1)';
          e.target.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(220, 38, 38, 0.9)';
          e.target.style.transform = 'translateY(0)';
        }}
      >
        Log out
      </button>

      <header className="App-header">
        {/* Header - Notion style */}
        <h1>
          <span style={{ marginRight: '0.5rem' }}>📸</span>
          Overshoot Vision
        </h1>
        
        {/* Camera Preview */}
        <div style={{ padding: '0 1rem' }}>
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
                Camera preview will appear here
              </div>
            )}
          </div>

            <div className="controls">
            {!isRunning ? (
              <button onClick={handleStart} className="btn btn-start">
                <span>▶</span>
                Start Camera & Audio
              </button>
            ) : (
              <button onClick={handleStop} className="btn btn-stop">
                <span>■</span>
                Stop Camera & Audio
              </button>
            )}
          </div>
          
            <div className="prompt-control">
            <input
              type="text"
              placeholder="Update prompt (e.g., 'Count the number of people')"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.target.value) {
                  handleUpdatePrompt(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={!isRunning}
            />
          </div>

          {/* Audio Recording Status */}
          {isRecording && (
            <div className="audio-recording-indicator" style={{ 
              marginTop: '1rem', 
              padding: '0.5rem', 
              background: 'rgba(255,0,0,0.2)', 
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <span>🎤 Live transcription active...</span>
            </div>
          )}

          {audioTranscript && (
            <div className="transcript-display" style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '8px' 
            }}>
              <h4>Live Transcript:</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{audioTranscript.text}</p>
              <small style={{ opacity: 0.7 }}>Updated: {audioTranscript.timestamp}</small>
            </div>
          )}
        </div>
        {/* Generated Headshot Display */}
        {(generatedImage || isGenerating) && (
          <div className="generated-headshot">
            <h2>Generated Headshot</h2>
            {isGenerating ? (
              <div className="generating-state">
                <div className="spinner"></div>
                <p>Generating professional headshot...</p>
                <p className="buffer-info">Processing 2 screenshots with Gemini AI</p>
              </div>
            ) : generatedImage ? (
              <div className="headshot-image-container">
                <img 
                  src={generatedImage} 
                  alt="Generated professional headshot" 
                  className="headshot-image"
                />
                <button 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = generatedImage;
                    link.download = `headshot-${Date.now()}.png`;
                    link.click();
                  }}
                  className="btn btn-download"
                >
                  Download Headshot
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Screenshot Buffer Indicator */}
        {screenshotBuffer.length > 0 && screenshotBuffer.length < 2 && (
          <div style={{ padding: '0 1rem' }}>
            <div className="buffer-indicator">
              <p>Screenshots collected: {screenshotBuffer.length}/2</p>
            </div>
          </div>
        )}

        <div className="results">
          <h2>Results</h2>
          {results.length === 0 ? (
            <p className="no-results">No results yet. Start the camera to begin.</p>
          ) : (
            <div className="results-list">
              {results.slice(-10).reverse().map((result, index) => (
                <div key={index} className="result-item">
                  <div className="result-text">{result.text}</div>
                  <div className="result-meta">
                    <span>{result.timestamp}</span>
                    {result.inferenceLatency !== null && (
                      <>
                        <span>Inference: {result.inferenceLatency}ms</span>
                        <span>Total: {result.totalLatency}ms</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;

