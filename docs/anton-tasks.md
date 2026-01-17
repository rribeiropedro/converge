# Anton - LiveKit Integration Tasks

## Overview
Anton is responsible for the **audio processing pipeline** that extracts structured profile data from conversations. This is a critical component that powers the core value proposition of NexHacks: turning spoken conversations into queryable relationship profiles.

---

## How This Connects to Overall Features

### Core Feature: Audio Processing (Section 5.3)
Your work directly enables:
- **Recording Initiation (5.2)**: Frontend streams audio to your WebSocket endpoint
- **Profile Merging (5.5)**: Your structured output gets merged with visual data
- **Profile Approval UI (5.6)**: Users review the data you extracted
- **Voice Agent Search (7.1)**: Your transcription powers natural language queries

### Data Flow
```
User speaks → Device captures audio → Your WebSocket → LiveKit transcription 
→ LLM profile extraction → Structured JSON → Yaw's merge endpoint → MongoDB
```

---

## PHASE 1 - CORE TASKS

### 1. Set up LiveKit WebSocket Connection
**Priority:** P0 (Blocker)  
**Dependencies:** None  
**Deliverable:** WebSocket server endpoint accepting audio streams

**Details:**
- Create WebSocket endpoint: `ws://your-server/livekit` or integrate with LiveKit's infrastructure
- Handle connection lifecycle (connect, disconnect, errors)
- Accept audio chunks from frontend (Pedro will send these)
- Set up authentication/authorization if needed

**Integration Point:**
- Pedro needs this endpoint URL to connect from React frontend

---

### 2. Stream Audio Chunks from Device
**Priority:** P0 (Blocker)  
**Dependencies:** Task #1 complete  
**Deliverable:** Receiving and buffering audio data

**Details:**
- Accept audio chunks (likely 250ms intervals as per PRD)
- Buffer audio for processing
- Handle network interruptions gracefully
- Validate audio format/quality

**Integration Point:**
- Pedro streams audio chunks via WebSocket from device microphone

---

### 3. Integrate Speech-to-Text Transcription
**Priority:** P0 (Blocker)  
**Dependencies:** Task #2 complete  
**Deliverable:** Real-time transcript of conversation

**Details:**
- Use LiveKit's transcription capabilities or integrate with speech-to-text API
- Transcribe audio in real-time or batch mode
- Handle multiple speakers if possible
- Return transcript chunks as they're generated

**Output:**
```javascript
{
  event: "transcript_chunk",
  text: "Hi, I'm Sarah Chen from Stripe...",
  timestamp: 1234567890
}
```

---

### 4. Build Profile Extraction Pipeline (LLM-based)
**Priority:** P0 (Blocker)  
**Dependencies:** Task #3 complete  
**Deliverable:** LLM prompt + extraction logic

**Details:**
- Design prompt to extract structured data from transcript
- Extract: name, company, role, topics, challenges, follow-up hooks, personal details
- Use Anthropic API (Claude) or similar LLM
- Handle edge cases (unclear names, multiple people mentioned, etc.)

**Extraction Targets:**
- `name`: Person's name (high priority)
- `company`: Company/organization name
- `role`: Job title or role
- `topics_discussed`: Array of conversation topics
- `their_challenges`: Problems they mentioned
- `follow_up_hooks`: Action items or promises made
- `personal_details`: Personal information shared

**Integration Point:**
- Yaw needs to know your output schema to build merge endpoint

---

### 5. Return Structured Data with Confidence Scores
**Priority:** P0 (Blocker)  
**Dependencies:** Task #4 complete  
**Deliverable:** Final output matching PRD schema

**Details:**
- Calculate confidence scores for each extracted field
- Confidence levels: "high", "medium", "low"
- Return complete profile object matching Section 5.3 schema
- Emit `processing_complete` event when done

**Output Schema (from PRD Section 5.3):**
```json
{
  "transcript": "Full conversation text...",
  "profile": {
    "name": { "value": "Sarah Chen", "confidence": "high" },
    "company": { "value": "Stripe", "confidence": "high" },
    "role": { "value": "Climate Team Lead", "confidence": "medium" }
  },
  "topics_discussed": ["climate tech", "hiring", "startup life"],
  "their_challenges": ["Looking for UX designer"],
  "follow_up_hooks": [
    { "type": "resource_share", "detail": "Send McKinsey report" }
  ],
  "personal_details": ["Has a dog named Pixel"]
}
```

**Integration Point:**
- Yaw's merge endpoint expects this exact structure
- Pedro's UI displays confidence scores to users

---

### 6. Handle Poor Audio Quality Gracefully
**Priority:** P0 (Blocker)  
**Dependencies:** All above tasks  
**Deliverable:** Error handling and fallbacks

**Details:**
- Detect low-quality audio (background noise, distance, etc.)
- Return appropriate error messages or low confidence scores
- Provide partial results when possible
- Log issues for debugging

---

## PHASE 2 - STRETCH TASKS

### 7. Voice Agent Input Processing
**Priority:** P2 (Stretch)  
**Dependencies:** Phase 1 complete  
**Deliverable:** Voice query transcription for search

**Details:**
- Process voice queries like "Who was the scout from a16z?"
- Transcribe user's search queries
- Pass to Yaw for query parsing

**Integration Point:**
- Yaw's voice search endpoint (Section 7.1)

---

### 8. Intent Parsing for Search Queries
**Priority:** P2 (Stretch)  
**Dependencies:** Task #7  
**Deliverable:** Extract search filters from natural language

**Details:**
- Parse queries to extract: company, role, event, appearance, time range
- Use LLM to understand user intent
- Return structured query filters

**Example:**
```
Input: "Who was the person in blue shirt by Stripe booth?"
Output: {
  appearance: "blue shirt",
  environment: "Stripe booth"
}
```

---

### 9. Integration with Eleven Labs for TTS Responses
**Priority:** P2 (Stretch)  
**Dependencies:** Task #8  
**Deliverable:** Spoken responses to voice queries

**Details:**
- Generate text responses to search queries
- Convert to speech using Eleven Labs API
- Stream audio back to frontend
- Handle different voice options

---

## Deliverables Summary

### WebSocket Endpoints
- `ws://your-server/livekit` - Audio streaming endpoint

### Event Types
- `transcript_chunk` - Real-time transcript updates
- `profile_extracted` - Structured profile data ready
- `processing_complete` - Full processing done with final output
- `error` - Error events with details

### Output Schema
Must match PRD Section 5.3 exactly for integration with Yaw's merge endpoint.

---

## Dependencies on Other Team Members

### Needs from Pedro:
- WebSocket connection from frontend
- Audio stream format specification
- Event handling requirements

### Needs from Yaw:
- Expected output schema format (already in PRD)
- Merge endpoint URL when ready
- Any schema changes or additions

### Provides to Pedro:
- WebSocket endpoint URL
- Event schema documentation
- Real-time transcript updates (for UI display)

### Provides to Yaw:
- Complete structured profile data
- Confidence scores for review logic
- Transcript for storage

---

## Testing Checklist

- [ ] WebSocket accepts connections
- [ ] Audio chunks received and buffered
- [ ] Transcription working (test with sample audio)
- [ ] Profile extraction working (test with sample transcript)
- [ ] Confidence scores calculated correctly
- [ ] Output matches PRD schema exactly
- [ ] Error handling works for poor audio
- [ ] Integration test with Yaw's merge endpoint

---

## Key Files to Create/Modify

```
backend/
  src/
    services/
      livekit/
        websocket.js          # WebSocket server
        transcription.js      # Speech-to-text logic
        extraction.js          # LLM profile extraction
        confidence.js         # Confidence scoring
    routes/
      livekitRoutes.js       # API routes if needed
```

---

## Notes

- **LiveKit Account**: Set up LiveKit account early (Hour 0-2)
- **LLM API Key**: Get Anthropic API key for profile extraction
- **Error Handling**: Plan for network issues, API failures, poor audio
- **Performance**: Profile extraction might take 5-10 seconds - communicate this to frontend
- **Schema Changes**: Coordinate with Yaw if schema needs to change

---

**Good luck! Your work is critical for the core value proposition. 🎙️**
