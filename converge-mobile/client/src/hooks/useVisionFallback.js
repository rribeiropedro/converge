/**
 * Vision Fallback Hook - Alternative to Overshoot SDK
 * Uses canvas frame capture + server-side OpenRouter Vision API for face detection and appearance analysis
 */

import { useRef, useCallback } from 'react';

/**
 * Hook that provides face detection and appearance analysis without Overshoot SDK
 * Uses periodic frame capture from video element + server-side vision API analysis
 */
export function useVisionFallback({
  videoRef,
  onResult,
  onError,
  sessionSocket,
  intervalMs = 2000, // Analyze every 2 seconds
  enabled = true
}) {
  const intervalRef = useRef(null);
  const isRunningRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const MAX_CONSECUTIVE_ERRORS = 3;

  /**
   * Capture a frame from the video element as base64 JPEG
   */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      console.warn('[VisionFallback] Video not ready');
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      // Use smaller resolution for faster API calls
      const maxWidth = 640;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Return as base64 JPEG with moderate quality
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch (error) {
      console.error('[VisionFallback] Frame capture error:', error);
      return null;
    }
  }, [videoRef]);

  /**
   * Analyze a frame using the backend vision API
   */
  const analyzeFrame = useCallback(async (frameBase64) => {
    try {
      const response = await fetch('/api/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: frameBase64 })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      consecutiveErrorsRef.current = 0; // Reset error counter on success
      return result;
    } catch (error) {
      consecutiveErrorsRef.current++;
      console.error('[VisionFallback] Analysis error:', error);
      throw error;
    }
  }, []);

  /**
   * Main analysis loop - captures frame and sends for analysis
   */
  const runAnalysis = useCallback(async () => {
    if (!isRunningRef.current) return;

    // Stop if too many consecutive errors
    if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
      console.error('[VisionFallback] Too many consecutive errors, stopping');
      onError?.(new Error('Too many consecutive errors'));
      stop();
      return;
    }

    const startTime = Date.now();
    const frameBase64 = captureFrame();

    if (!frameBase64) {
      console.warn('[VisionFallback] No frame captured, skipping');
      return;
    }

    try {
      const result = await analyzeFrame(frameBase64);
      const inferenceLatency = Date.now() - startTime;

      console.log('[VisionFallback] Analysis result:', {
        face_detected: result.face_detected,
        latency_ms: inferenceLatency
      });

      // Format result to match Overshoot SDK format
      const formattedResult = {
        result: JSON.stringify({
          face_detected: result.face_detected || false,
          appearance_profile: result.appearance_profile || '',
          environment_context: result.environment_context || ''
        }),
        inference_latency_ms: inferenceLatency,
        total_latency_ms: inferenceLatency
      };

      // Send to session socket if connected
      if (sessionSocket?.current?.connected) {
        sessionSocket.current.emit('session:visual', formattedResult);
      }

      // Call onResult callback
      onResult?.(formattedResult);
    } catch (error) {
      onError?.(error);
    }
  }, [captureFrame, analyzeFrame, onResult, onError, sessionSocket]);

  /**
   * Start the vision fallback analysis loop
   */
  const start = useCallback(() => {
    if (isRunningRef.current) {
      console.warn('[VisionFallback] Already running');
      return;
    }

    if (!enabled) {
      console.warn('[VisionFallback] Fallback disabled');
      return;
    }

    console.log('[VisionFallback] Starting analysis loop');
    isRunningRef.current = true;
    consecutiveErrorsRef.current = 0;

    // Run immediately, then set interval
    runAnalysis();
    intervalRef.current = setInterval(runAnalysis, intervalMs);
  }, [enabled, intervalMs, runAnalysis]);

  /**
   * Stop the vision fallback analysis loop
   */
  const stop = useCallback(() => {
    console.log('[VisionFallback] Stopping analysis loop');
    isRunningRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return {
    start,
    stop,
    captureFrame,
    isRunning: () => isRunningRef.current
  };
}

export default useVisionFallback;
