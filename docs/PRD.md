# NexHacks PRD
## Augmented Memory for Professional Networking

**Version:** 1.0  
**Last Updated:** January 2026  
**Team:** Anton, Magnus, Pedro, Yaw

---

# Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Technical Architecture](#4-technical-architecture)
5. [Core Features (Phase 1)](#5-core-features-phase-1)
6. [Demo Checkpoint](#6-demo-checkpoint)
7. [Stretch Features (Phase 2)](#7-stretch-features-phase-2)
8. [Team Assignments](#8-team-assignments)
9. [Development Timeline](#9-development-timeline)
10. [API Contracts](#10-api-contracts)
11. [Database Schema](#11-database-schema)
12. [Demo Script](#12-demo-script)

---

# 1. Executive Summary

**Product Name:** NexHacks (working title)

**One-liner:** An AI-powered personal CRM that captures the essence of real conversations to help professionals build authentic, lasting relationships.

**Core Value Proposition:**
- Record conversations at networking events
- AI extracts structured profiles from audio + visual data
- Query your network via voice: "Who was that VC from a16z?"
- Get smart follow-up suggestions based on conversation context

**Tech Stack:**
- Frontend: Next.js 16 + React 18, TypeScript, Tailwind CSS, shadcn/ui, D3.js
- Backend: Express.js (ES modules), MongoDB + Mongoose, Socket.IO
- Database: MongoDB Atlas
- Audio Processing: Deepgram (live transcription via Socket.IO)
- Video/Visual Processing: Overshoot SDK
- AI Services: OpenRouter (Claude for profile extraction), face-api.js (face embeddings)
- Mobile: React app in `converge-mobile/` for Overshoot SDK video capture

---

# 2. Problem Statement

### The Current State
Professionals meet dozens of people at conferences, meetups, and industry events. They exchange LinkedIn connections or business cards, but:

- **80% of these connections become meaningless within 48 hours**
- Existing tools (LinkedIn, CRMs) capture *transactional* data, not *relational* context
- Users forget: what they discussed, what the person looked like, what follow-ups were promised
- Generic "Great meeting you!" follow-ups feel hollow and ineffective

### The Gap
There's no tool that captures the *qualitative depth* of a real conversation and makes it actionable for relationship building.

### Our Opportunity
Use AI to turn fleeting conversations into rich, queryable relationship profiles that enable authentic follow-up.

---

# 3. Solution Overview

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  1. CAPTURE                                                     │
│     User records conversation at networking event               │
│     → Audio stream to LiveKit                                   │
│     → Video stream to Overshoot                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. PROCESS (Parallel)                                          │
│     LiveKit: Transcription → Profile extraction (name, company, │
│              topics, follow-up hooks)                           │
│     Overshoot: Face embedding, appearance description,          │
│                environment context                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. MERGE + APPROVE                                             │
│     Combine audio + visual data into draft profile              │
│     User reviews, edits low-confidence fields, approves         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. QUERY + ACT                                                 │
│     Voice agent: "Who did I meet that works in AI?"             │
│     Network graph: Filter by industry, event, time              │
│     Follow-up suggestions: AI-generated personalized messages   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Differentiators

| Traditional CRM | NexHacks |
|-----------------|----------|
| Manual data entry | Auto-extracted from conversation |
| Generic contact fields | Rich context (topics, challenges, follow-up hooks) |
| Text-based search | Voice-powered natural language queries |
| Static profiles | Visual memory (appearance, environment) |
| No follow-up intelligence | AI-suggested personalized outreach |

---

# 4. Technical Architecture

### System Diagram

```
┌──────────────┐
│  React App   │
│  (Frontend)  │
└──────┬───────┘
       │
       │ REST API / WebSocket
       │
┌──────▼───────┐      ┌─────────────┐      ┌─────────────┐
│  Express.js  │◄────►│   Deepgram  │      │  Overshoot  │
│  (Backend)   │      │   (Audio)   │      │   (Video)   │
│  Socket.IO   │      │             │      │   SDK       │
└──────┬───────┘      └─────────────┘      └─────────────┘
       │
       │
┌──────▼───────┐      ┌─────────────┐
│   MongoDB    │      │  OpenRouter │
│   Atlas      │      │   (Claude)  │
│   + Vector   │      │             │
│   Search     │      └─────────────┘
└──────────────┘
```

### Data Flow

1. **Capture Phase**
   - Device captures audio + video simultaneously
   - Audio chunks → Deepgram via Socket.IO WebSocket (`/api/transcribe/live`)
   - Video frames → Overshoot SDK (mobile app) → POST `/api/overshoot-result`

2. **Processing Phase**
   - Deepgram returns: real-time transcript chunks
   - OpenRouter/Claude extracts: profile fields, topics, follow-up hooks (via `transcriptParser.js`)
   - Overshoot returns: face detection, visual data
   - OpenRouter/Claude extracts: appearance, environment descriptions (via `visualParser.js`)
   - face-api.js generates: 128-dim face embeddings

3. **Storage Phase**
   - Merged profile → MongoDB `connections` collection (via `processingService.js`)
   - Face embedding → Stored in connection document (vector search ready)
   - Interaction logged → MongoDB `interactions` collection
   - Face matching → Checks against existing connections for re-recognition

4. **Query Phase**
   - Network graph visualization with D3.js
   - Analytics dashboard with aggregated metrics
   - AI-powered recommendations via OpenRouter/Claude

---

# 5. Core Features (Phase 1)

These features constitute the MVP and must be completed before the demo checkpoint.

---

## 5.1 User Authentication

**Priority:** P0 (Blocker)  
**Owner:** Pedro

### Requirements
- [x] User can sign up with email/password
- [x] User can log in
- [x] JWT-based session management
- [x] Protected routes in React

**Status:** ✅ **IMPLEMENTED**
- Backend: `/api/users` POST (signup), `/api/users/login` POST (login), `/api/users/me` GET (current user)
- Frontend: Auth page with login/signup, protected route wrapper component
- JWT stored in localStorage, auth middleware for Express routes

### Technical Details
- Use `bcrypt` for password hashing
- JWT stored in httpOnly cookie or localStorage
- Auth middleware for Express routes

### API Endpoints
```
POST /api/users          → { email, password, name } (signup)
POST /api/users/login    → { email, password } (login)
POST /api/users/logout   → Logout
GET  /api/users/me       → Current user (protected)
```

**Implementation Notes:**
- Uses bcrypt for password hashing
- JWT tokens stored in localStorage
- Auth middleware protects routes

---

## 5.2 Recording Initiation

**Priority:** P0 (Blocker)  
**Owner:** Pedro (UI), Anton (LiveKit), Magnus (Overshoot)

### Requirements
- [ ] User can start a new recording session
- [ ] User can set event context (event name, location)
- [ ] Recording captures both audio and video
- [ ] Visual indicator that recording is active
- [ ] User can stop recording

### User Flow
1. User taps "New Connection" button
2. Modal asks for event context (optional, can use default/last event)
3. User taps "Start Recording"
4. App shows recording indicator + live preview
5. User taps "Stop" when conversation ends
6. App shows "Processing..." state

### Technical Details
- Request microphone + camera permissions
- Initialize WebSocket connections to LiveKit and Overshoot
- Stream audio chunks to LiveKit (250ms intervals)
- Stream video frames to Overshoot (2 FPS)

---

## 5.3 Audio Processing (Deepgram)

**Priority:** P0 (Blocker)  
**Owner:** Anton

**Status:** ✅ **IMPLEMENTED** (Using Deepgram instead of LiveKit)

### Requirements
- [x] Receive audio stream via WebSocket
- [x] Transcribe speech to text in real-time
- [x] Extract structured profile data from transcript
- [x] Return confidence scores for each field

### Output Schema
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

### Integration Points
- WebSocket endpoint for audio streaming
- Callback/event when processing complete
- Error handling for poor audio quality

**Implementation Details:**
- Socket.IO namespace: `/api/transcribe/live`
- Deepgram SDK integration in `transcribeController.js`
- Real-time transcription with `transcript` events
- Profile extraction via OpenRouter/Claude in `transcriptParser.js`
- Supports batch file transcription via POST `/api/transcribe`

---

## 5.4 Video Processing (Overshoot)

**Priority:** P0 (Blocker)  
**Owner:** Magnus

**Status:** ✅ **IMPLEMENTED**

### Requirements
- [x] Receive video frames via WebSocket
- [x] Detect and track face(s) in frame
- [x] Generate face embedding for primary subject
- [x] Generate appearance description
- [x] Generate environment description

### Output Schema
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
  }
}
```

### Integration Points
- WebSocket endpoint for video frames
- Handle multiple faces (identify primary speaker)
- Callback/event when processing complete

**Implementation Details:**
- Overshoot SDK integration in mobile app (`converge-mobile/`)
- POST `/api/overshoot-result` endpoint receives processed results
- Visual parsing via OpenRouter/Claude in `visualParser.js`
- Face embedding generation using face-api.js (128-dim vectors)
- Headshot generation via POST `/api/generate-headshot` using OpenRouter/Gemini

---

## 5.5 Profile Merging & Storage

**Priority:** P0 (Blocker)  
**Owner:** Yaw

**Status:** ✅ **IMPLEMENTED**

### Requirements
- [x] Merge LiveKit and Overshoot outputs into unified profile
- [x] Add system context (timestamp, location, event)
- [x] Calculate which fields need manual review
- [x] Save draft profile to MongoDB
- [x] Create vector search index for face embedding

### Merge Logic
```javascript
function mergeProfile(audioData, visualData, context) {
  return {
    user_id: context.userId,
    status: 'draft',
    
    // From LiveKit
    name: audioData.profile.name,
    company: audioData.profile.company,
    role: audioData.profile.role,
    
    audio: {
      topics_discussed: audioData.topics_discussed,
      their_challenges: audioData.their_challenges,
      follow_up_hooks: audioData.follow_up_hooks,
      personal_details: audioData.personal_details,
      transcript_summary: summarize(audioData.transcript)
    },
    
    // From Overshoot
    visual: {
      face_embedding: visualData.face_embedding,
      appearance: visualData.appearance,
      environment: visualData.environment
    },
    
    // System context
    context: {
      event: context.event,
      location: context.location,
      first_met: new Date()
    },
    
    // Review flags
    needs_review: calculateNeedsReview(audioData),
    fields_needing_review: getFieldsNeedingReview(audioData)
  };
}
```

### API Endpoints
```
POST /api/connections/process  → Merge audio + visual data (creates draft)
GET  /api/connections/:id     → Get single connection
GET  /api/connections         → List all connections (with search/filter/pagination)
POST /api/connections/:id/add-interaction → Add interaction to existing connection
POST /api/connections/confirm-match → Confirm face match
POST /api/connections/reject-match → Reject face match
```

**Implementation Details:**
- Profile merging in `processingService.js`
- Confidence scoring in `confidenceService.js`
- Face matching and re-recognition in `faceMatching.js`
- Schema validation in `schemaValidator.js`
- MongoDB indexes created for text search and user_id queries

---

## 5.6 Profile Approval UI

**Priority:** P0 (Blocker)  
**Owner:** Pedro

**Status:** ✅ **IMPLEMENTED**

### Requirements
- [x] Display draft profile with all extracted data
- [x] Highlight low-confidence fields for review
- [x] Allow inline editing of any field
- [x] Approve button saves as final profile
- [x] Discard button deletes draft

### UI Components
```
┌─────────────────────────────────────────┐
│  Review New Connection                  │
├─────────────────────────────────────────┤
│  ┌────┐                                 │
│  │ 👤 │  [Sarah Chen      ] ← editable  │
│  └────┘  [Stripe • Climate] ← editable  │
│                                         │
│  👔 Appearance                          │
│  "Blue blazer, short hair" ✓ AI        │
│                                         │
│  📍 Where you met                       │
│  "By the coffee station" ✓ AI          │
│                                         │
│  💬 Topics discussed                    │
│  [climate tech] [hiring] [+]            │
│                                         │
│  🎯 Follow-up hooks                     │
│  ⚠️ "Looking for UX designer"           │
│     [Edit] [Remove]                     │
│                                         │
│  ┌─────────┐  ┌─────────┐              │
│  │ Approve │  │ Discard │              │
│  └─────────┘  └─────────┘              │
└─────────────────────────────────────────┘
```

### API Endpoints
```
PATCH /api/connections/:id/approve  → Approve with edits
DELETE /api/connections/:id         → Discard draft
```

**Implementation Details:**
- Review page at `/review/[id]` with full profile display
- Confidence badges (high/medium/low) with color coding
- Inline editing for all fields
- Follow-up hooks with completion checkboxes
- Approve/Discard actions with confirmation dialogs

---

## 5.7 Connections List (Network Grid)

**Priority:** P0 (Blocker)  
**Owner:** Pedro

**Status:** ✅ **IMPLEMENTED**

### Requirements
- [x] Display all approved connections as cards/grid
- [x] Show: name, company, role, event, date
- [x] Show visual appearance snippet
- [x] Click to view full profile
- [x] Basic search/filter by name

### UI Components
```
┌─────────────────────────────────────────┐
│  My Network                    [Search] │
├─────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Sarah C │  │ Jake K  │  │ Amy L   │ │
│  │ Stripe  │  │ a16z    │  │ Cohere  │ │
│  │ Jan 17  │  │ Jan 17  │  │ Jan 16  │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Marcus  │  │ ...     │  │ ...     │ │
│  │ OpenAI  │  │         │  │         │ │
│  │ Jan 15  │  │         │  │         │ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘
```

### API Endpoints
```
GET /api/connections?search=&event=&limit=&offset=&status=
```

**Implementation Details:**
- Connections page at `/connections` with card grid layout
- Search functionality
- Filter by status (draft/approved)
- Pagination support
- Connection cards show key information with click-through to detail view

---

## 5.8 Connection Detail View

**Priority:** P1 (Important)  
**Owner:** Pedro

**Status:** ✅ **IMPLEMENTED**

### Requirements
- [x] Display full profile information
- [x] Show all conversation topics
- [x] Show follow-up hooks with completion status
- [x] Show interaction history
- [x] Edit profile button

### UI Components
```
┌─────────────────────────────────────────┐
│  ← Back                        [Edit]   │
├─────────────────────────────────────────┤
│  ┌────────┐                             │
│  │  👤    │  Sarah Chen                 │
│  │        │  Stripe • Climate Team Lead │
│  └────────┘  Met at NexHacks • Jan 17   │
│                                         │
│  ─────────────────────────────────────  │
│  👔 APPEARANCE                          │
│  Blue blazer, short dark hair, glasses  │
│                                         │
│  📍 WHERE YOU MET                       │
│  By the coffee station near main stage  │
│                                         │
│  💬 TOPICS DISCUSSED                    │
│  • Climate tech initiatives             │
│  • Hiring challenges                    │
│  • Startup culture                      │
│                                         │
│  🎯 FOLLOW-UP HOOKS                     │
│  ☐ Send McKinsey climate report         │
│  ☐ Intro to Marcus (climate VC)         │
│                                         │
│  📝 PERSONAL NOTES                      │
│  Has a dog named Pixel                  │
│  Wants to visit Tokyo                   │
│                                         │
│  ─────────────────────────────────────  │
│  INTERACTIONS                           │
│  • Jan 17 - First meeting at NexHacks   │
│                                         │
│  [Follow Up]                            │
└─────────────────────────────────────────┘
```

**Implementation Details:**
- Profile detail page at `/profile/[id]`
- Full profile display with all sections
- Follow-up hooks with completion tracking
- Interaction history display
- Edit functionality for profile updates

---

# 6. Demo Checkpoint

⚠️ **STOP HERE BEFORE STRETCH FEATURES**

After completing Phase 1, record a backup demo video showing:

### Demo Script (2-3 minutes)

1. **Intro (15s)**
   - "Meet NexHacks - your AI-powered networking memory"
   - Show app landing/home screen

2. **Record a Conversation (45s)**
   - Tap "New Connection"
   - Set event: "NexHacks 2026"
   - Start recording
   - Have a brief conversation (can be staged between team members)
   - Stop recording
   - Show "Processing..." state

3. **Review & Approve Profile (30s)**
   - Show the draft profile with extracted data
   - Point out: name, company, appearance, topics
   - Make a quick edit to show the manual fallback
   - Approve the profile

4. **View Network (30s)**
   - Show the connections grid with multiple profiles
   - Click into one profile to show detail view
   - Highlight the follow-up hooks

5. **Value Prop Recap (15s)**
   - "Never forget a face or a conversation again"
   - "Turn networking into real relationships"

### Recording Tips
- Use screen recording (QuickTime/OBS)
- Have test data pre-loaded for smooth demo
- Script the "conversation" so it extracts good data
- Record multiple takes

---

# 7. Stretch Features (Phase 2)

Only begin these after Phase 1 is complete and demo is recorded.

---

## 7.1 Voice Agent Search

**Priority:** P2 (Stretch)  
**Owner:** Anton (LiveKit), Yaw (Query logic)  
**Value Add:** ⭐⭐⭐ High demo impact

### Requirements
- [ ] Voice input via LiveKit
- [ ] Parse natural language to search intent
- [ ] Query MongoDB with extracted filters
- [ ] Return results to UI
- [ ] Spoken response via Eleven Labs

### Query Types to Support
| Query | Extracted Filters |
|-------|-------------------|
| "Who was the scout from a16z?" | company: a16z, role: scout |
| "Person in blue shirt by Stripe booth" | appearance: blue shirt, environment: Stripe booth |
| "Everyone I met at NexHacks who works in AI" | event: NexHacks, topics: AI |
| "Who did I meet yesterday?" | time_range: yesterday |

### API Endpoints
```
POST /api/search/voice    → { transcript, parsed_query, results }
POST /api/search/text     → { query } (fallback)
```

---

## 7.2 Network Analytics Dashboard

**Priority:** P2 (Stretch)  
**Owner:** Pedro (UI), Yaw (MongoDB aggregations)  
**Value Add:** ⭐⭐⭐ Visual polish

**Status:** ✅ **IMPLEMENTED**

### Metrics to Display
- [x] Total connections / this month
- [x] Pending follow-ups count
- [x] Events attended count
- [x] Connections by industry (bar chart)
- [x] Connections over time (line chart)
- [x] Top events by connection count
- [x] Relationship type breakdown
- [x] Follow-up completion rate
- [x] Active connections count
- [x] Topics discussed breakdown
- [x] Location breakdown
- [x] Company breakdown
- [x] AI-powered network recommendations

### API Endpoints
```
GET  /api/analytics/network        → Complete analytics data
POST /api/analytics/recommendations → AI-generated recommendations
```

**Implementation Details:**
- Analytics dashboard at `/dashboard/analytics`
- Comprehensive metrics with visualizations (charts using Recharts)
- Growth data over time
- Industry, location, company, event type aggregations
- Follow-up statistics and topic analysis
- AI-powered recommendations using Claude via OpenRouter
- Service: `networkAnalyticsService.js` with aggregation logic

---

## 7.3 Smart Follow-up Suggestions

**Priority:** P2 (Stretch)  
**Owner:** Yaw  
**Value Add:** ⭐⭐⭐ Core value prop

### Requirements
- [ ] Identify connections needing follow-up
- [ ] Generate personalized message via LLM
- [ ] Match user's resources to connection's interests
- [ ] One-click send (copy to clipboard or email)
- [ ] Mark follow-up as complete

### Suggestion Logic
1. Find connections with incomplete follow-up hooks
2. Find connections met 3-14 days ago with no follow-up
3. Rank by urgency (promised actions first)
4. Generate personalized message referencing conversation

### API Endpoints
```
GET  /api/followups/pending
GET  /api/followups/:connectionId/suggestion
POST /api/followups/:connectionId/complete
```

---

## 7.4 LinkedIn Profile Enrichment

**Priority:** P3 (Nice-to-have)  
**Owner:** Yaw  
**Value Add:** ⭐⭐ Polish

### Requirements
- [ ] Search LinkedIn by name + company
- [ ] Match using face embedding (if multiple candidates)
- [ ] Pull: work history, education, skills, photo
- [ ] Update connection profile with enriched data
- [ ] Manual LinkedIn URL entry as fallback

### API Endpoints
```
POST /api/connections/:id/enrich
POST /api/connections/:id/enrich/manual  → { linkedin_url }
```

### Notes
- Use Proxycurl API (~$0.03/profile)
- For hackathon, manual URL entry may be sufficient

---

## 7.5 Network Graph Visualization

**Priority:** P3 (Nice-to-have)  
**Owner:** Pedro  
**Value Add:** ⭐⭐ Visual wow

**Status:** ✅ **IMPLEMENTED**

### Requirements
- [x] Visual graph of all connections
- [x] Filter by: industry, event, time, tags
- [x] Click node to see profile
- [x] Cluster by common attributes

### Technical Notes
- Use D3.js or react-force-graph
- Nodes = connections, edges = shared attributes

**Implementation Details:**
- Network graph component using D3.js force-directed layout
- Dashboard page at `/dashboard` with interactive graph
- Filter panel for date range, location, grouping
- Node preview cards on hover
- Click nodes to navigate to profile detail
- Grouping by industry, event, location
- Graph legend and controls

---

# 8. Team Assignments

## Anton - LiveKit Integration

### Core (Phase 1)
- [x] Set up Deepgram WebSocket connection (via Socket.IO)
- [x] Stream audio chunks from device
- [x] Integrate speech-to-text transcription
- [x] Build profile extraction pipeline (LLM-based via OpenRouter/Claude)
- [x] Return structured profile data with confidence scores
- [x] Handle poor audio quality gracefully

**Implementation:**
- Socket.IO namespace `/api/transcribe/live` for real-time transcription
- Deepgram SDK integration in `transcribeController.js`
- Profile extraction in `transcriptParser.js` using Claude
- Batch transcription support via POST `/api/transcribe`

### Stretch (Phase 2)
- [ ] Voice agent input processing
- [ ] Intent parsing for search queries
- [ ] Integration with Eleven Labs for TTS responses

### Deliverables
- ✅ WebSocket endpoint: Socket.IO namespace `/api/transcribe/live`
- ✅ Event types: `transcript`, `ready`, `error`, `closed`
- ✅ Profile schema matching specification in Section 5.3
- ✅ Real-time transcription with Deepgram
- ✅ Profile extraction with confidence scores

---

## Magnus - Overshoot Integration

### Core (Phase 1)
- [x] Set up Overshoot SDK integration (mobile app)
- [x] Stream video frames from device
- [x] Face detection and tracking
- [x] Generate face embedding (128-dim vector via face-api.js)
- [x] Generate appearance description (via OpenRouter/Claude)
- [x] Generate environment/location description (via OpenRouter/Claude)
- [x] Handle multiple faces (identify primary speaker)
- [x] Headshot generation via AI (OpenRouter/Gemini)

### Stretch (Phase 2)
- [ ] Face re-recognition for returning connections
- [ ] Nametag/badge text extraction (if supported)
- [ ] Real-time face matching against existing profiles

### Deliverables
- ✅ POST endpoint: `/api/overshoot-result` (receives processed results)
- ✅ POST endpoint: `/api/generate-headshot` (AI headshot generation)
- ✅ Visual schema matching specification in Section 5.4
- ✅ Face embedding service using face-api.js
- ✅ Face matching and re-recognition system
- ✅ Visual parsing via OpenRouter/Claude

---

## Pedro - Project Setup + Frontend

### Core (Phase 1)
- [x] Initialize Next.js project (React 18, TypeScript)
- [x] Initialize Express server
- [x] Set up MongoDB Atlas connection
- [x] Implement authentication (signup/login/JWT)
- [x] Build recording initiation UI (mobile app)
- [x] Build profile approval/editing UI
- [x] Build connections list (network grid)
- [x] Build connection detail view
- [x] Connect frontend to backend APIs
- [x] Build network graph visualization
- [x] Build analytics dashboard

### Stretch (Phase 2)
- [ ] Voice agent UI (mic button + results display)
- [x] Analytics dashboard with charts
- [ ] Follow-up suggestions UI
- [x] Network graph visualization

### Deliverables
- ✅ Next.js app with App Router and routing
- ✅ Express API with all documented endpoints
- ✅ MongoDB connection pooling
- ✅ Responsive UI (mobile-first with Tailwind CSS)
- ✅ shadcn/ui component library integration
- ✅ TypeScript throughout frontend

---

## Yaw - Agent Development + Schema + Backend Logic

### Core (Phase 1)
- [x] Design and document MongoDB schema
- [x] Create MongoDB indexes (text search, vector search)
- [x] Build profile merge endpoint (`/api/connections/process`)
- [x] Implement confidence scoring logic
- [x] Implement fields needing review logic
- [x] Test end-to-end flow with mock data
- [x] Face matching and re-recognition system
- [x] Schema validation service
- [x] Face embedding service

### Stretch (Phase 2)
- [ ] Voice search query parsing (LLM prompt)
- [x] MongoDB aggregation queries for analytics
- [x] Network recommendations generation (LLM prompt via OpenRouter/Claude)
- [ ] LinkedIn enrichment integration
- [ ] Resource matching logic

### Deliverables
- ✅ MongoDB schema documentation (`db_structure.md`)
- ✅ API endpoints: `/api/connections/process`, `/api/analytics/network`, `/api/analytics/recommendations`
- ✅ LLM prompts for profile extraction, visual parsing, and recommendations
- ✅ Face matching service with cosine similarity
- ✅ Confidence scoring and review flagging
- ✅ Processing service for profile merging

---

# 9. Development Timeline

Assuming a 24-48 hour hackathon:

## Hour 0-2: Setup
- [ ] Pedro: Initialize repos, MongoDB Atlas, deploy skeleton
- [ ] Anton: Set up LiveKit account and test connection
- [ ] Magnus: Set up Overshoot account and test connection
- [ ] Yaw: Document schema, create collections, indexes

## Hour 2-8: Core Integration
- [ ] Anton: Audio streaming + transcription working
- [ ] Magnus: Video streaming + face embedding working
- [ ] Pedro: Auth + recording UI complete
- [ ] Yaw: Merge endpoint working with mock data

## Hour 8-14: Core Feature Complete
- [ ] Anton: Profile extraction from transcript working
- [ ] Magnus: Appearance + environment descriptions working
- [ ] Pedro: Approval UI + connections list complete
- [ ] Yaw: Full merge pipeline tested end-to-end

## Hour 14-16: Integration Testing
- [ ] All: Test complete flow together
- [ ] All: Fix integration bugs
- [ ] All: Prepare test data for demo

## Hour 16-18: Demo Recording ⚠️
- [ ] Record backup demo video
- [ ] Upload to safe location

## Hour 18-24+: Stretch Features
- [ ] Voice agent (Anton + Yaw)
- [ ] Analytics dashboard (Pedro + Yaw)
- [ ] Follow-up suggestions (Yaw + Pedro)

## Final Hours: Polish
- [ ] UI polish
- [ ] Demo preparation
- [ ] Presentation slides

---

# 10. API Contracts

## Authentication

### POST /api/auth/signup
```json
// Request
{ "email": "user@example.com", "password": "...", "name": "Yaw" }

// Response
{ "user": { "_id": "...", "email": "...", "name": "..." }, "token": "jwt..." }
```

### POST /api/auth/login
```json
// Request
{ "email": "user@example.com", "password": "..." }

// Response
{ "user": { "_id": "...", "email": "...", "name": "..." }, "token": "jwt..." }
```

## Connections

### POST /api/connections/merge
```json
// Request
{
  "audio": {
    "transcript": "...",
    "profile": {
      "name": { "value": "Sarah Chen", "confidence": "high" },
      "company": { "value": "Stripe", "confidence": "high" },
      "role": { "value": "PM", "confidence": "medium" }
    },
    "topics_discussed": ["climate tech", "hiring"],
    "their_challenges": ["Need UX designer"],
    "follow_up_hooks": [{ "type": "resource_share", "detail": "Send report" }],
    "personal_details": ["Has a dog named Pixel"]
  },
  "visual": {
    "face_embedding": [0.023, -0.156, ...],
    "appearance": { "description": "Blue blazer, glasses" },
    "environment": { "description": "By coffee station" }
  },
  "context": {
    "event": { "name": "NexHacks 2026", "type": "hackathon" },
    "location": { "name": "SF", "city": "San Francisco" }
  }
}

// Response
{
  "_id": "...",
  "status": "draft",
  "name": { "value": "Sarah Chen", "confidence": "high", "source": "livekit" },
  "company": { ... },
  "role": { ... },
  "visual": { ... },
  "audio": { ... },
  "context": { ... },
  "needs_review": true,
  "fields_needing_review": ["role"]
}
```

### GET /api/connections
```json
// Response
{
  "connections": [
    { "_id": "...", "name": {...}, "company": {...}, "context": {...} },
    ...
  ],
  "total": 47,
  "limit": 20,
  "offset": 0
}
```

### GET /api/connections/:id
```json
// Response
{ /* Full connection document */ }
```

### PATCH /api/connections/:id/approve
```json
// Request
{
  "updates": {
    "name.value": "Sarah Chen",
    "role.value": "Senior PM, Climate"
  }
}

// Response
{ /* Updated connection with status: "approved" */ }
```

### DELETE /api/connections/:id
```json
// Response
{ "deleted": true }
```

## Search (Stretch)

### POST /api/search/voice
```json
// Request
{ "transcript": "Who was the scout from a16z I met at NexHacks?" }

// Response
{
  "parsed_query": {
    "company": "a16z",
    "role": "scout",
    "event": "NexHacks"
  },
  "results": [ /* matching connections */ ],
  "result_type": "single",
  "spoken_response": "I found Jake Kim, a scout from a16z..."
}
```

## Analytics (Stretch)

### GET /api/analytics/overview
```json
// Response
{
  "total_connections": 47,
  "connections_this_month": 12,
  "pending_follow_ups": 8,
  "events_attended": 5
}
```

## Follow-ups (Stretch)

### GET /api/followups/pending
```json
// Response
[
  {
    "connection_id": "...",
    "connection_name": "Sarah Chen",
    "company": "Stripe",
    "days_since_meeting": 3,
    "suggested_message": "Hi Sarah! Great meeting you at NexHacks...",
    "reason": "You promised to send a resource",
    "follow_up_type": "resource_share"
  }
]
```

---

# 11. Database Schema

## Collection: users
```javascript
{
  _id: ObjectId,
  email: String,           // unique
  password_hash: String,
  name: String,
  created_at: Date,
  settings: {
    default_event: String | null,
    voice_agent_enabled: Boolean
  }
}
```

## Collection: connections
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,       // Reference to users
  status: String,          // "draft" | "approved" | "archived"
  
  // Identity
  name: { value: String, confidence: String, source: String },
  company: { value: String, confidence: String, source: String },
  role: { value: String, confidence: String, source: String },
  
  // Visual (from Overshoot)
  visual: {
    face_embedding: [Number],  // 512-dim vector
    appearance: {
      description: String,
      distinctive_features: [String]
    },
    environment: {
      description: String,
      landmarks: [String]
    }
  },
  
  // Audio (from LiveKit)
  audio: {
    topics_discussed: [String],
    their_challenges: [String],
    follow_up_hooks: [{
      type: String,           // "resource_share" | "intro_request" | "meeting" | "other"
      detail: String,
      completed: Boolean,
      completed_at: Date | null
    }],
    personal_details: [String],
    transcript_summary: String
  },
  
  // Context
  context: {
    event: { name: String, type: String },
    location: { name: String, city: String },
    first_met: Date
  },
  
  // Categorization
  tags: [String],
  industry: String,
  relationship_type: String,
  
  // Enrichment (stretch)
  enrichment: {
    linkedin: { url: String, ... },
    experience: [...],
    education: [...],
    skills: [...]
  },
  
  // Metadata
  needs_review: Boolean,
  fields_needing_review: [String],
  interaction_count: Number,
  last_interaction: Date,
  last_contacted: Date | null,
  created_at: Date,
  updated_at: Date
}
```

## Collection: interactions
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  connection_id: ObjectId,
  type: String,            // "first_meeting" | "follow_up" | "meeting"
  timestamp: Date,
  duration_seconds: Number,
  transcript_summary: String,
  visual_snapshot: {
    appearance_at_time: String,
    environment_at_time: String
  },
  created_at: Date
}
```

## Collection: events
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  name: String,
  type: String,            // "hackathon" | "conference" | "meetup" | "other"
  location: { name: String, city: String },
  date_start: Date,
  date_end: Date,
  connection_count: Number
}
```

## Indexes

```javascript
// Text search
db.connections.createIndex({
  "name.value": "text",
  "company.value": "text",
  "audio.topics_discussed": "text",
  "audio.transcript_summary": "text",
  "visual.appearance.description": "text",
  "visual.environment.description": "text",
  "tags": "text"
})

// Vector search (create in Atlas UI)
// Index name: face_vector_index
// Path: visual.face_embedding
// Dimensions: 512
// Similarity: cosine

// Compound indexes
db.connections.createIndex({ user_id: 1, status: 1 })
db.connections.createIndex({ user_id: 1, "context.event.name": 1 })
db.connections.createIndex({ user_id: 1, "context.first_met": -1 })

// Interactions
db.interactions.createIndex({ connection_id: 1, timestamp: -1 })
```

---

# 12. Demo Script

## Final Presentation Demo (5 minutes)

### Opening (30s)
"Have you ever met someone amazing at a conference, exchanged LinkedIn connections, and then completely forgotten what made that conversation special? We built NexHacks to solve that."

### Problem (30s)
"Traditional networking tools capture contact information, but they miss the context - what you actually talked about, what they looked like, what you promised to follow up on. 80% of networking connections become meaningless within 48 hours."

### Solution Demo (3 min)

**1. Recording (45s)**
- "Let me show you how it works. I'm at a conference and I just met someone interesting."
- Start recording
- Have brief conversation
- Stop recording
- "While I was talking, NexHacks was analyzing both the audio AND the visual context."

**2. Profile Review (45s)**
- "Here's what it extracted: their name, company, role - all from the conversation."
- "It also noted what they look like - blue blazer, by the coffee station - so I can remember them."
- "And most importantly, it captured the follow-up hooks - they're looking for a UX designer."
- Approve profile

**3. Query Network (45s)**
- "Now I have 15 connections from this event. But later, I might forget details."
- Tap mic button
- "Who was the person from Stripe who needed a UX designer?"
- Show result
- "NexHacks finds them instantly, with all the context I need."

**4. Follow-up (45s)**
- "Three days later, NexHacks reminds me to follow up."
- Show follow-up suggestion
- "It even drafts a personalized message based on our actual conversation."
- "This turns a business card into a real relationship."

### Closing (30s)
"NexHacks transforms how professionals build their networks - from collecting contacts to cultivating connections. We built this in 24 hours using LiveKit, Overshoot, and MongoDB. The future is never forgetting a face or a conversation again."

### Q&A Prep
- **Privacy?** "Only the user has access. We don't share or sell data. It's your personal memory."
- **Accuracy?** "We show confidence scores and let users edit anything the AI got wrong."
- **Why not just take notes?** "Notes capture what you remember. We capture what actually happened."

---

# Appendix: Environment Variables

```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# Auth
JWT_SECRET=your-secret-key

# Deepgram (Audio Transcription)
DEEPGRAM_API_KEY=...

# Overshoot
OVERSHOOT_API_KEY=...
OVERSHOOT_WS_URL=wss://...

# Eleven Labs (stretch)
ELEVEN_LABS_API_KEY=...
ELEVEN_LABS_VOICE_ID=...

# Proxycurl (stretch)
PROXYCURL_API_KEY=...

# OpenRouter (for LLM processing - Claude, Gemini)
OPEN_ROUTER_API_KEY=...
# or
OPENROUTER_API_KEY=...
```

---

**End of PRD**

*Good luck, team! Build something amazing. 🚀*