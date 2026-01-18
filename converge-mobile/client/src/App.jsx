import React, { useState, useRef, useEffect } from 'react';
import { RealtimeVision } from '@overshoot/sdk';
import './App.css';

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [screenshotBuffer, setScreenshotBuffer] = useState([]);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const visionRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Overshoot Vision Starter</h1>
        
        {/* Camera Preview */}
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
              Start Camera
            </button>
          ) : (
            <button onClick={handleStop} className="btn btn-stop">
              Stop Camera
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
        {/* Generated Headshot Display */}
        {(generatedImage || isGenerating) && (
          <div className="generated-headshot">
            <h2>Generated Headshot:</h2>
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
          <div className="buffer-indicator">
            <p>Screenshots collected: {screenshotBuffer.length}/2</p>
          </div>
        )}

        <div className="results">
          <h2>Results:</h2>
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

