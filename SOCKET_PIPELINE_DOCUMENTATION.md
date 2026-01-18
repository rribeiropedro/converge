# Socket Communication Pipeline: Frontend (Mobile) ↔️ Backend

## Overview
This document tracks the complete socket communication flow between the converge-mobile frontend and the backend Express server.

---

## 🔌 Socket Connection Setup

### Frontend Initialization
**File:** `converge-mobile/client/src/CameraRecorder.jsx`
**Line:** ~260-270

```javascript
const sessionSocket = io('http://localhost:3001/api/session', {
  transports: ['websocket']
});
```

### Backend Namespace Registration
**File:** `backend/src/realtime/sessionSocket.js`
**Line:** 33-36

```javascript
const SESSION_NAMESPACE = '/api/session';
const namespace = io.of(SESSION_NAMESPACE);
namespace.on('connection', (socket) => { ... });
```

---

## 📡 Socket Events Pipeline

### 1️⃣ SESSION START

#### Frontend → Backend
**Event:** `session:start`
**File:** `converge-mobile/client/src/CameraRecorder.jsx:353`
**Payload:**
```javascript
{
  sessionId: 'session-1768728498734-zzlzjtm2g',
  userId: '507f1f77bcf86cd799439011',
  context: {
    event: { name: 'NexHacks 2026', type: 'hackathon' },
    location: { name: 'Test Location', city: 'San Francisco' }
  }
}
```

#### Backend Processing
**File:** `backend/src/realtime/sessionSocket.js:152-179`
1. Validates `sessionId` and `userId` (required)
2. Creates session in `SessionManager`
3. Stores socket reference in `sessionSocketMap`
4. Logs: `[SessionSocket] Session started: ${sessionId} for user ${userId}`

#### Backend → Frontend
**Event:** `session:ready`
**File:** `backend/src/realtime/sessionSocket.js:171-174`
**Payload:**
```javascript
{
  sessionId: 'session-1768728498734-zzlzjtm2g',
  message: 'Session initialized'
}
```

#### Frontend Handler
**File:** `converge-mobile/client/src/CameraRecorder.jsx:267-276`
- Sets `sessionStatus` to 'recording'
- Adds result: '✅ Session initialized'

---

### 2️⃣ VISUAL DATA STREAM (Overshoot SDK)

#### Frontend → Backend
**Event:** `session:visual`
**File:** `converge-mobile/client/src/CameraRecorder.jsx:424-427`
**Triggered by:** Overshoot SDK `onResult` callback
**Payload:**
```javascript
{
  result: '{"face_detected": true, "appearance_profile": "Silver blazer...", "environment_context": "..."}',
  inference_latency_ms: 250,
  total_latency_ms: 450
}
```

#### Backend Processing
**File:** `backend/src/realtime/sessionSocket.js:182-223`
1. Checks if session exists
2. Parses visual data (JSON string → object)
3. Calls `parseVisualData()` to process
4. Updates session via `SessionManager.updateVisual()`
5. Gets updated session state

#### Backend → Frontend
**Event:** `session:visual_update`
**File:** `backend/src/realtime/sessionSocket.js:211-218`
**Payload:**
```javascript
{
  visual: {
    face_embedding: true,
    appearance: 'Silver blazer, graphic tee, square glasses',
    environment: 'Noisy VIP lounge'
  },
  message: 'Visual intel locked'
}
```

#### Frontend Handler
**File:** `converge-mobile/client/src/CameraRecorder.jsx:277-284`
- Adds result: '📸 Visual intel locked: Face detected'

---

### 3️⃣ AUDIO DATA STREAM (Live Transcription)

#### Frontend → Backend
**Event:** `session:audio`
**File:** `converge-mobile/client/src/CameraRecorder.jsx:126-133`
**Triggered by:** MediaRecorder `ondataavailable` (every 250ms)
**Payload:** `ArrayBuffer` (audio chunk in WebM/Opus format)

#### Backend Processing
**File:** `backend/src/realtime/sessionSocket.js:227-259`
1. Checks if session exists
2. Creates Deepgram connection if not already started
3. Converts chunk to Buffer
4. Queues chunks until Deepgram connection is ready
5. Forwards buffer to Deepgram via `deepgramConnection.send(buffer)`

**Deepgram Connection Setup:**
**File:** `backend/src/realtime/sessionSocket.js:62-149`
```javascript
deepgramConnection = createLiveTranscriptionConnection({
  model: 'nova-3',
  language: 'en',
  diarize: true,
  smart_format: true,
  interim_results: true,
  encoding: 'opus'
});
```

#### Deepgram → Backend (Internal)
**Event:** `LiveTranscriptionEvents.Transcript`
**File:** `backend/src/realtime/sessionSocket.js:97-135`
- Receives transcript from Deepgram
- Extracts: `transcript`, `words`, `speaker`, `is_final`
- Updates session via `SessionManager.updateAudio()`

#### Backend → Frontend
**Event:** `session:audio_update`
**File:** `backend/src/realtime/sessionSocket.js:123-130`
**Payload:**
```javascript
{
  transcript_chunk: 'Hello, my name is John',
  is_final: true,
  speaker: 0,
  accumulated_transcript: 'Hello, my name is John and I work at...'
}
```

#### Frontend Handler
**File:** `converge-mobile/client/src/CameraRecorder.jsx:286-304`
- Updates `audioTranscript` state
- Adds result with speaker prefix: '💬 [Speaker 0] Hello, my name is John'

---

### 4️⃣ FACE MATCH RESULT (Background Processing)

#### Backend Processing (Asynchronous)
**File:** `backend/src/controllers/overshootController.js:309-433`
**Triggered by:** Headshot generation completion
1. Generates face embedding from headshot image
2. Searches MongoDB for matching connections
3. Calculates similarity scores
4. Updates session via `SessionManager.updateFaceMatch()`

#### Backend → Frontend
**Event:** `face_match_result`
**File:** `backend/src/controllers/overshootController.js:422-425`
**Payload (Match Found):**
```javascript
{
  matched: true,
  name: 'John Doe',
  company: 'Acme Corp',
  profileImage: 'https://...',
  insights: [
    { type: 'bullet', text: 'Name: John Doe' },
    { type: 'bullet', text: 'Company: Acme Corp' },
    { type: 'bullet', text: 'Match confidence: 87%' },
    { type: 'bullet', text: 'Previous connection found' }
  ]
}
```

**Payload (New Contact):**
```javascript
{
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
}
```

#### Frontend Handler
**File:** `converge-mobile/client/src/CameraRecorder.jsx:306-323`
1. Updates `insightsData` state with received insights
2. Sets `profileImage` if available
3. Shows overlay: `setShowInsightsOverlay(true)`
4. Adds result: '🎯 Face match: John Doe' or 'New contact detected'

---

### 5️⃣ SESSION END

#### Frontend → Backend
**Event:** `session:end`
**File:** `converge-mobile/client/src/CameraRecorder.jsx:500-507`
**Payload:** None (no data sent)

#### Backend Processing
**File:** `backend/src/realtime/sessionSocket.js:262-343`
1. Closes Deepgram connection
2. Finalizes session via `SessionManager.finalizeSession()`
3. Parses full transcript if not already parsed
4. Creates draft connection in MongoDB via `createDraftConnection()`
5. Cleans up socket reference

#### Backend → Frontend
**Event:** `session:finalized`
**File:** `backend/src/realtime/sessionSocket.js:326-334`
**Payload:**
```javascript
{
  connectionId: '507f1f77bcf86cd799439011',
  profile: {
    name: 'John Doe',
    company: 'Acme Corp',
    status: 'draft'
  },
  message: 'Session finalized and saved to database'
}
```

#### Frontend Handler
**File:** `converge-mobile/client/src/CameraRecorder.jsx:324-332`
- Sets `sessionStatus` to 'finalized'
- Adds result: '✅ Session finalized! Connection ID: 507f...'

---

### 6️⃣ ERROR HANDLING

#### Backend → Frontend
**Event:** `session:error`
**Multiple locations in:** `backend/src/realtime/sessionSocket.js`
**Payload:**
```javascript
{
  message: 'Error description',
  details: { ... } // Optional additional error info
}
```

#### Frontend Handler
**File:** `converge-mobile/client/src/CameraRecorder.jsx:334-341`
- Adds result: '❌ Session error: Error description'

---

### 7️⃣ DISCONNECT

#### Frontend Action
**File:** `converge-mobile/client/src/CameraRecorder.jsx:527-530`
```javascript
sessionSocket.disconnect();
```

#### Backend Handler
**File:** `backend/src/realtime/sessionSocket.js:346-366`
1. Closes Deepgram connection
2. Checks for stale sessions
3. Cleans up socket reference
4. Logs: `[SessionSocket] Client disconnected: ${socket.id}`

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                             │
│  (converge-mobile/client/src/CameraRecorder.jsx)                │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ 1. session:start
                               │    { sessionId, userId, context }
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVER                           │
│     (backend/src/realtime/sessionSocket.js)                     │
│                                                                   │
│  • Creates session in SessionManager                            │
│  • Stores socket reference                                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ 2. session:ready
                               │    { sessionId, message }
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                             │
│  • Sets sessionStatus = 'recording'                             │
│  • Starts camera/microphone                                     │
│  • Starts Overshoot SDK                                         │
│  • Starts audio recording                                       │
└─────────────────────────────────────────────────────────────────┘
                    │                        │
      ┌─────────────┘                        └─────────────┐
      │ 3a. session:visual                   3b. session:audio │
      │    (Overshoot results)               │    (Audio chunks)
      ▼                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVER                           │
│                                                                   │
│  VISUAL PATH:                    AUDIO PATH:                    │
│  • parseVisualData()             • Forward to Deepgram          │
│  • SessionManager.updateVisual() • Receive transcripts          │
│  • (Face detection triggers      • SessionManager.updateAudio() │
│     headshot generation)                                         │
│                                                                   │
│  HEADSHOT GENERATION:                                            │
│  • /api/generate-headshot (HTTP)                                │
│  • Generate face embedding                                      │
│  • Find matching connection                                     │
│  • SessionManager.updateFaceMatch()                             │
└─────────────────────────────────────────────────────────────────┘
      │                    │                        │
      │ 4a. session:       │ 4b. session:          │ 4c. face_
      │ visual_update      │ audio_update          │ match_result
      ▼                    ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                             │
│  • Shows visual intel     • Shows transcripts    • Shows overlay│
│  • Captures screenshots   • Updates transcript   • Displays     │
│                             display                insights      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ 5. session:end
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVER                           │
│  • Finalizes session                                            │
│  • Parses full transcript                                       │
│  • Saves to MongoDB (createDraftConnection)                     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ 6. session:finalized
                               │    { connectionId, profile }
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                             │
│  • Shows connection ID                                          │
│  • Stops camera/microphone                                      │
│  • Disconnects socket                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Key Files Reference

### Frontend (Mobile Client)
- **Main Component:** `converge-mobile/client/src/CameraRecorder.jsx`
- **Auth Utils:** `converge-mobile/client/src/authUtils.js`

### Backend (Server)
- **Session Socket:** `backend/src/realtime/sessionSocket.js`
- **Session Manager:** `backend/src/realtime/SessionManager.js`
- **Face Processing:** `backend/src/controllers/overshootController.js`
- **Visual Parser:** `backend/src/services/visualParser.js`
- **Transcript Parser:** `backend/src/services/transcriptParser.js`
- **Face Embedding:** `backend/src/services/faceEmbeddingService.js`
- **Face Matching:** `backend/src/services/faceMatching.js`

---

## 🛠️ Debugging Tips

1. **Frontend Console Logs:** Check browser console (F12) for:
   - `🚀 Starting recording session...`
   - `✅ Session ID generated`
   - `🔌 Connecting to session WebSocket...`
   - `📷 Requesting camera and microphone permissions...`
   - `👁️ Initializing Overshoot Vision SDK...`

2. **Backend Server Logs:** Check terminal for:
   - `[SessionSocket] Client connected: ${socket.id}`
   - `[SessionSocket] Session started: ${sessionId}`
   - `[SessionSocket] Deepgram connection opened`
   - `[SessionSocket] 🎵 Audio chunk #1 received`
   - `[SessionSocket] Deepgram response: is_final=true`

3. **Common Issues:**
   - **"No authenticated user found"** → User not logged in, check localStorage
   - **WebSocket connection failed** → Backend not running on port 3001
   - **Camera permissions denied** → Browser blocking access
   - **No transcripts** → Check Deepgram API key and audio format

---

## 🔐 Authentication Flow

Before any socket communication, user must be authenticated:

1. **Login:** `POST /api/users/login`
2. **Store:** Token + user in localStorage
3. **Verify:** `getUser()` returns valid user with `id` or `_id`
4. **Use:** `userId` sent in `session:start` event

If authentication fails, frontend redirects to `/` (login page).

---

## ⚡ Performance Notes

- **Audio chunks:** Sent every 250ms
- **Visual updates:** Based on Overshoot SDK processing (1s clips, 1s delay)
- **Face embedding:** Lazy loaded on first use (avoids C++ binding errors at startup)
- **Stale sessions:** Auto-finalized after 60 seconds of inactivity
- **Socket reconnection:** Automatic via Socket.IO with exponential backoff

---

## 📊 Data Flow Summary

| Data Type | Source | Destination | Event | Frequency |
|-----------|--------|-------------|-------|-----------|
| Session Start | Frontend | Backend | `session:start` | Once per session |
| Session Ready | Backend | Frontend | `session:ready` | Once per session |
| Visual Data | Frontend (Overshoot) | Backend | `session:visual` | ~1Hz |
| Visual Update | Backend | Frontend | `session:visual_update` | ~1Hz |
| Audio Chunks | Frontend (MediaRecorder) | Backend | `session:audio` | 4Hz (250ms) |
| Audio Update | Backend (Deepgram) | Frontend | `session:audio_update` | Variable |
| Face Match | Backend (Async) | Frontend | `face_match_result` | Once per face |
| Session End | Frontend | Backend | `session:end` | Once per session |
| Session Finalized | Backend | Frontend | `session:finalized` | Once per session |
| Errors | Backend | Frontend | `session:error` | As needed |

---

Generated: 2026-01-18

