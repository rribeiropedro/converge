# Headshot Generation Debugging Guide

## Current Issue
Headshots and face embeddings are not being generated/stored, causing face matching to always fail and create new connections instead of updating existing ones.

## Expected Flow

1. **Mobile App (CameraRecorder.jsx)**:
   - Overshoot SDK detects faces → sets `face_detected: true`
   - Captures 2 screenshots when face detected
   - Calls `/api/generate-headshot` with screenshots + sessionId

2. **Backend (`/api/generate-headshot`)**:
   - Receives 2 screenshots + sessionId
   - Calls OpenRouter/Gemini to generate professional headshot
   - Stores headshot in session via `SessionManager.updateVisual()`
   - Generates face embedding from headshot
   - Stores face embedding in session
   - Performs face matching against existing connections

3. **Session Finalization**:
   - Uses stored face embedding to match against database
   - Updates existing connection if match found (score >= 0.80)
   - Creates new connection if no match

## Debugging Steps

### 1. Check if Headshot Endpoint is Being Called

Look for these logs in the terminal:
```
🔔 HEADSHOT GENERATION REQUEST RECEIVED
  Request body keys: ...
  Has screenshots: true
  Screenshot count: 2
  Session ID: session-...
```

**If you DON'T see this log:**
- The mobile app isn't calling the endpoint
- Check mobile app console for errors
- Verify `face_detected === true` in Overshoot results
- Check if screenshots are being captured

### 2. Check Overshoot Face Detection

Look for these logs:
```
=== Overshoot Result ===
Face Detected: ✅ YES / ❌ NO
```

**If face_detected is always false:**
- Overshoot SDK isn't detecting faces properly
- Check Overshoot API key
- Verify camera permissions
- Check video quality/lighting

### 3. Check Visual Data Parsing

Look for these logs:
```
📥 Raw visual data received for session ...
  📋 Parsed Overshoot Result:
    face_detected: true/false
    appearance_profile: Present/Missing
    environment_context: Present/Missing
```

**If face_detected is missing or false:**
- Overshoot results aren't being parsed correctly
- Check the `result.result` field structure

### 4. Check Headshot Generation

Look for these logs:
```
📷 HEADSHOT GENERATION [session-...]
  🔄 Generating headshot using OpenRouter/Gemini...
  ✓ Headshot Generated Successfully
    Image URL: ...
```

**If headshot generation fails:**
- Check OpenRouter API key
- Check OpenRouter credits/rate limits
- Verify Gemini model availability

### 5. Check Face Embedding Generation

Look for these logs:
```
🔄 Generating face embedding from headshot...
✓ Face Embedding Generated
  Dimensions: 128
  → Ready for face matching
```

**If face embedding generation fails:**
- Check face-api.js models are loaded
- Verify headshot image format is valid
- Check for face detection errors

### 6. Check Face Matching

Look for these logs:
```
🔍 FACE MATCHING [session-...]
  ✓ Face embedding available (128 dimensions)
  Searching database for matching face...
  ✓ MATCH FOUND / ○ NO MATCH FOUND
```

**If no face matching occurs:**
- Face embedding wasn't generated
- Check if embedding is stored in session
- Verify MongoDB vector search index exists

## Common Issues

### Issue 1: Headshot endpoint never called
**Symptoms:** No "HEADSHOT GENERATION REQUEST RECEIVED" logs
**Causes:**
- Overshoot not detecting faces (`face_detected: false`)
- Screenshots not being captured
- Mobile app error preventing API call

**Fix:**
- Check mobile app console logs
- Verify Overshoot API key
- Check camera/video stream quality

### Issue 2: Headshot generated but not stored
**Symptoms:** Headshot generation succeeds but session has no headshot
**Causes:**
- Session already finalized when headshot arrives
- Session ID mismatch
- `SessionManager.updateVisual()` failing

**Fix:**
- Ensure headshot is generated before session ends
- Verify sessionId matches
- Check for session update errors

### Issue 3: Face embedding not generated
**Symptoms:** Headshot exists but no face embedding
**Causes:**
- face-api.js models not loaded
- Invalid image format
- No face detected in headshot image

**Fix:**
- Run `./download-face-models.sh`
- Verify headshot image is valid base64/URL
- Check face-api.js error logs

### Issue 4: Face matching always fails
**Symptoms:** Face embedding exists but no matches found
**Causes:**
- No existing connections in database
- Vector search index not created
- Embedding format incorrect

**Fix:**
- Verify MongoDB Atlas vector search index exists
- Check existing connections have face_embedding
- Verify embedding is 128-dimensional array

## Next Steps

1. Run a test session and check for all the logs above
2. Identify which step is failing
3. Check the specific error messages
4. Verify all API keys and configurations
5. Check mobile app console for client-side errors
