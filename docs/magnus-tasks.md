# Magnus - Overshoot Integration Tasks

## Overview
Magnus is responsible for the **video processing pipeline** that extracts visual information from conversations. This includes face detection, appearance descriptions, environment context, and face embeddings for vector search. Your work enables users to remember what people look like and where they met them.

---

## How This Connects to Overall Features

### Core Feature: Video Processing (Section 5.4)
Your work directly enables:
- **Recording Initiation (5.2)**: Frontend streams video frames to your WebSocket endpoint
- **Profile Merging (5.5)**: Your visual data gets merged with audio data
- **Profile Approval UI (5.6)**: Users see appearance and environment descriptions
- **Voice Agent Search (7.1)**: Face embeddings enable "person in blue shirt" queries
- **Face Re-recognition (Stretch)**: Vector search finds returning connections

### Data Flow
```
Device camera → Video frames (2 FPS) → Your WebSocket → Overshoot processing
→ Face embedding + descriptions → Structured JSON → Yaw's merge endpoint → MongoDB
```

---

## PHASE 1 - CORE TASKS

### 1. Set up Overshoot WebSocket Connection
**Priority:** P0 (Blocker)  
**Dependencies:** None  
**Deliverable:** WebSocket server endpoint accepting video frames

**Details:**
- Create WebSocket endpoint: `ws://your-server/overshoot` or integrate with Overshoot's infrastructure
- Handle connection lifecycle (connect, disconnect, errors)
- Accept video frames from frontend (Pedro will send these)
- Set up authentication/authorization if needed
- Handle frame rate throttling (2 FPS as per PRD)

**Integration Point:**
- Pedro needs this endpoint URL to connect from React frontend

---

### 2. Stream Video Frames from Device (2 FPS)
**Priority:** P0 (Blocker)  
**Dependencies:** Task #1 complete  
**Deliverable:** Receiving and processing video frames

**Details:**
- Accept video frames at 2 frames per second (throttle if needed)
- Handle frame format (likely base64 encoded images or binary)
- Buffer frames for processing
- Handle network interruptions gracefully
- Validate frame quality

**Integration Point:**
- Pedro streams video frames via WebSocket from device camera

---

### 3. Face Detection and Tracking
**Priority:** P0 (Blocker)  
**Dependencies:** Task #2 complete  
**Deliverable:** Detected and tracked faces in video stream

**Details:**
- Use Overshoot's face detection capabilities
- Track faces across multiple frames
- Identify primary speaker/subject (person facing camera most)
- Handle multiple faces (prioritize primary subject)
- Return face bounding boxes and tracking IDs

**Output:**
```javascript
{
  event: "face_detected",
  faces: [
    {
      id: "face_1",
      bbox: { x: 100, y: 150, width: 200, height: 250 },
      is_primary: true,
      confidence: 0.95
    }
  ],
  timestamp: 1234567890
}
```

---

### 4. Generate Face Embedding (512-dim Vector)
**Priority:** P0 (Blocker)  
**Dependencies:** Task #3 complete  
**Deliverable:** 512-dimensional face embedding vector

**Details:**
- Extract face embedding from primary subject
- Generate 512-dimensional vector representation
- This vector will be stored in MongoDB for vector search
- Ensure consistent embedding format across sessions

**Output:**
```javascript
{
  event: "face_embedding",
  face_embedding: [0.023, -0.156, 0.789, ...], // 512 numbers
  face_id: "face_1",
  timestamp: 1234567890
}
```

**Integration Point:**
- Yaw needs this for MongoDB vector search index
- Used for face re-recognition in stretch features

---

### 5. Appearance Description
**Priority:** P0 (Blocker)  
**Dependencies:** Task #3 complete  
**Deliverable:** Text description of person's appearance

**Details:**
- Generate natural language description of appearance
- Include: clothing, hair, accessories, distinctive features
- Use Overshoot's vision capabilities or integrate with Gemini/Claude
- Return structured description

**Output Schema (from PRD Section 5.4):**
```json
{
  "appearance": {
    "description": "Blue blazer, short dark hair, glasses",
    "distinctive_features": ["glasses", "red lanyard"]
  }
}
```

**Integration Point:**
- Displayed in Profile Approval UI (Pedro)
- Used for voice search queries ("person in blue shirt")

---

### 6. Environment Description
**Priority:** P0 (Blocker)  
**Dependencies:** Task #2 complete  
**Deliverable:** Text description of meeting location/context

**Details:**
- Analyze video frames for environmental context
- Identify: location, landmarks, nearby objects, setting
- Generate natural language description
- Extract landmarks for searchability

**Output Schema (from PRD Section 5.4):**
```json
{
  "environment": {
    "description": "By the coffee station near main stage",
    "landmarks": ["coffee station", "Stripe booth"]
  }
}
```

**Integration Point:**
- Displayed in Profile Approval UI (Pedro)
- Used for voice search queries ("by Stripe booth")

---

### 7. Handle Multiple Faces (Identify Primary Speaker)
**Priority:** P0 (Blocker)  
**Dependencies:** Task #3 complete  
**Deliverable:** Logic to identify and prioritize primary subject

**Details:**
- Detect when multiple faces are present
- Identify which person is the primary subject (largest, most centered, facing camera)
- Focus processing on primary subject
- Optionally track secondary faces for context

**Integration Point:**
- Ensures correct face embedding for the person being profiled

---

### 8. Generate LinkedIn-Style Headshot (NEW TASK)
**Priority:** P1 (Important)  
**Dependencies:** Task #3, #4 complete  
**Deliverable:** Professional headshot image for profile photo

**Details:**
- Capture best frame with clear face from Overshoot video stream
- Extract face region from frame
- Use Gemini Vision API (or similar) to generate a professional LinkedIn-style headshot
- Prompt Gemini to create a clean, professional portrait based on the detected face
- Return headshot image (base64 or URL) for storage in MongoDB

**Output:**
```javascript
{
  event: "headshot_generated",
  headshot_url: "https://...", // or base64 data
  headshot_base64: "data:image/jpeg;base64,...",
  face_id: "face_1",
  timestamp: 1234567890
}
```

**Technical Approach:**
1. Select best frame (clearest face, good lighting, front-facing)
2. Crop face region with padding
3. Send to Gemini Vision API with prompt:
   ```
   "Generate a professional LinkedIn-style headshot portrait of this person. 
   Make it clean, professional, with neutral background. Maintain their 
   appearance and features accurately."
   ```
4. Store generated image in MongoDB or cloud storage
5. Include URL/reference in connection profile

**Integration Point:**
- Yaw's merge endpoint stores headshot in connection profile
- Pedro's UI displays headshot in connection cards and detail view
- Used in Connections List (Network Grid) for visual identification

**Files Needed:**
- Gemini API integration
- Image processing utilities
- Headshot generation service

---

## PHASE 2 - STRETCH TASKS

### 9. Face Re-recognition for Returning Connections
**Priority:** P2 (Stretch)  
**Dependencies:** Phase 1 complete, Yaw's vector search ready  
**Deliverable:** Match new faces against existing profiles

**Details:**
- When new face detected, generate embedding
- Query MongoDB vector search for similar faces
- If match found (similarity > threshold), link to existing connection
- Update connection with new interaction data

**Integration Point:**
- Yaw's MongoDB vector search index
- Yaw's connection update endpoint

---

### 10. Nametag/Badge Text Extraction
**Priority:** P2 (Stretch)  
**Dependencies:** Task #2 complete  
**Deliverable:** Extract text from conference badges/nametags

**Details:**
- Use OCR or vision API to read nametags
- Extract: name, company, role if visible
- Use as additional data source for profile extraction
- Combine with audio extraction for higher confidence

**Integration Point:**
- Can supplement Anton's audio extraction
- Yaw can merge nametag data with audio data

---

### 11. Real-time Face Matching Against Existing Profiles
**Priority:** P2 (Stretch)  
**Dependencies:** Task #9 complete  
**Deliverable:** Live recognition during recording

**Details:**
- During recording, continuously match faces
- If recognized, pre-populate profile with existing data
- Show user: "Is this [Name] from [Company]?"
- User can confirm or create new connection

**Integration Point:**
- Real-time UI updates (Pedro)
- Yaw's vector search API

---

## Deliverables Summary

### WebSocket Endpoints
- `ws://your-server/overshoot` - Video frame streaming endpoint

### Event Types
- `face_detected` - Face(s) detected in frame
- `face_embedding` - Face embedding vector ready
- `appearance` - Appearance description generated
- `environment` - Environment description generated
- `headshot_generated` - Professional headshot ready (NEW)
- `processing_complete` - Full processing done with final output
- `error` - Error events with details

### Output Schema
Must match PRD Section 5.4 exactly for integration with Yaw's merge endpoint.

**Complete Output:**
```json
{
  "face_embedding": [0.023, -0.156, ...],  // 512-dim vector
  "appearance": {
    "description": "Blue blazer, short dark hair, glasses",
    "distinctive_features": ["glasses", "red lanyard"]
  },
  "environment": {
    "description": "By the coffee station near main stage",
    "landmarks": ["coffee station", "Stripe booth"]
  },
  "headshot": {
    "url": "https://...",
    "base64": "data:image/jpeg;base64,..."
  }
}
```

---

## Dependencies on Other Team Members

### Needs from Pedro:
- WebSocket connection from frontend
- Video frame format specification (format, size, encoding)
- Frame rate coordination (2 FPS)
- Event handling requirements

### Needs from Yaw:
- Expected output schema format (already in PRD)
- Merge endpoint URL when ready
- Vector search index setup for face embeddings
- Storage solution for headshot images

### Provides to Pedro:
- WebSocket endpoint URL
- Event schema documentation
- Real-time face detection updates (for UI display)
- Headshot images for profile display

### Provides to Yaw:
- Face embedding vector (for vector search)
- Appearance and environment descriptions
- Headshot image (for profile photo)
- Visual data for merge endpoint

---

## Testing Checklist

- [ ] WebSocket accepts connections
- [ ] Video frames received and processed
- [ ] Face detection working (test with sample video)
- [ ] Face embedding generated (verify 512 dimensions)
- [ ] Appearance description generated
- [ ] Environment description generated
- [ ] Primary speaker identification works
- [ ] Headshot generation working with Gemini
- [ ] Output matches PRD schema exactly
- [ ] Error handling works for poor video quality
- [ ] Integration test with Yaw's merge endpoint
- [ ] Multiple faces handled correctly

---

## Key Files to Create/Modify

```
backend/
  src/
    services/
      overshoot/
        websocket.js          # WebSocket server
        faceDetection.js      # Face detection logic
        embedding.js          # Face embedding generation
        appearance.js         # Appearance description
        environment.js        # Environment description
        headshot.js           # Gemini headshot generation (NEW)
    routes/
      overshootRoutes.js     # API routes if needed
```

---

## Notes

- **Overshoot Account**: Set up Overshoot account early (Hour 0-2)
- **Gemini API Key**: Get Google Gemini API key for headshot generation
- **Frame Rate**: Stick to 2 FPS to avoid overwhelming the system
- **Face Embedding**: Ensure consistent format - this is critical for vector search
- **Headshot Quality**: Test Gemini prompts to get best quality headshots
- **Error Handling**: Plan for poor lighting, no faces, multiple faces, network issues
- **Performance**: Processing might take 3-5 seconds per frame batch - communicate this to frontend
- **Schema Changes**: Coordinate with Yaw if schema needs to change

---

## Gemini Headshot Generation - Detailed Implementation

### Step-by-Step Process:

1. **Frame Selection**
   - After face detection, select best frame:
     - Highest face detection confidence
     - Face is front-facing (not profile view)
     - Good lighting
     - Face size is reasonable (not too small/large)

2. **Face Cropping**
   - Extract face region with padding (include shoulders/upper body)
   - Resize to standard dimensions (e.g., 512x512 or 1024x1024)
   - Maintain aspect ratio

3. **Gemini API Call**
   ```javascript
   // Pseudo-code
   const prompt = `
   Generate a professional LinkedIn-style headshot portrait of this person.
   Requirements:
   - Clean, professional appearance
   - Neutral background (white or light gray)
   - Professional lighting
   - Maintain accurate facial features and appearance
   - Business-appropriate styling
   - High quality, 1024x1024 resolution
   `;
   
   const response = await gemini.generateContent({
     contents: [{
       parts: [
         { text: prompt },
         { inlineData: { mimeType: "image/jpeg", data: croppedFaceBase64 } }
       ]
     }]
   });
   ```

4. **Image Storage**
   - Store generated headshot in MongoDB GridFS or cloud storage (S3, Cloudinary)
   - Save URL reference in connection document
   - Include in merge endpoint output

5. **Error Handling**
   - If Gemini fails, fall back to original cropped face
   - Log errors for debugging
   - Return null/empty if generation fails

---

**Good luck! Your visual data makes connections memorable. 🎥**
