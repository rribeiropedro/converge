# Pedro - Project Setup + Frontend Tasks

## Overview
Pedro is responsible for **project infrastructure, authentication, and the entire frontend experience**. You're the foundation that connects all the pieces together - setting up the React app, Express backend, MongoDB connection, and building all the user-facing interfaces.

---

## How This Connects to Overall Features

### Core Infrastructure
Your work enables:
- **User Authentication (5.1)**: Users can sign up, log in, and access the app
- **Recording Initiation (5.2)**: Users start recording sessions
- **Profile Approval UI (5.6)**: Users review and edit extracted profiles
- **Connections List (5.7)**: Users browse their network
- **Connection Detail View (5.8)**: Users see full profile information
- **All Integrations**: You connect to Anton's and Magnus's WebSocket endpoints

### Data Flow
```
User → React UI → Express API → MongoDB
User → React UI → WebSocket → Anton (audio) / Magnus (video)
```

---

## PHASE 1 - CORE TASKS

### 1. Initialize React Project
**Priority:** P0 (Blocker)  
**Dependencies:** None  
**Deliverable:** Working React app with routing

**Details:**
- Use Vite (recommended) or Create React App
- Set up routing (React Router)
- Configure build tools and dev server
- Set up folder structure:
  ```
  src/
    components/
    pages/
    services/
    hooks/
    utils/
  ```

**Tech Stack:**
- React 18+
- React Router for navigation
- Tailwind CSS (or your preferred styling)
- Axios or Fetch for API calls

---

### 2. Initialize Express Server
**Priority:** P0 (Blocker)  
**Dependencies:** None  
**Deliverable:** Working Express backend

**Details:**
- Set up Express.js server
- Configure middleware (CORS, body-parser, etc.)
- Set up route structure
- Configure environment variables (.env)
- Set up error handling middleware

**File Structure:**
```
backend/
  src/
    index.js
    routes/
    controllers/
    models/
    middleware/
    config/
```

---

### 3. MongoDB Atlas Connection
**Priority:** P0 (Blocker)  
**Dependencies:** Task #2 complete  
**Deliverable:** Connected to MongoDB Atlas

**Details:**
- Create MongoDB Atlas account (if not done)
- Create cluster and database
- Get connection string
- Set up Mongoose connection in `backend/src/config/database.js`
- Test connection
- Set up connection pooling
- Handle connection errors gracefully

**Environment Variable:**
```env
MONGODB_URI=mongodb+srv...
```

**Integration Point:**
- Yaw will use this connection for schema setup
- All API endpoints will use this database

---

### 4. Authentication (Signup/Login/JWT)
**Priority:** P0 (Blocker)  
**Dependencies:** Task #3 complete  
**Deliverable:** Full auth flow working

**Details:**
- Create User model (Mongoose schema)
- Implement password hashing (bcrypt)
- Create signup endpoint: `POST /api/auth/signup`
- Create login endpoint: `POST /api/auth/login`
- Generate JWT tokens
- Create auth middleware for protected routes
- Store JWT in httpOnly cookie or localStorage
- Create logout endpoint: `POST /api/auth/logout`
- Create "me" endpoint: `GET /api/auth/me` (get current user)

**Frontend:**
- Signup page/component
- Login page/component
- Auth context/hooks for managing user state
- Protected route wrapper
- Redirect logic (logged in → dashboard, not logged in → login)

**API Endpoints (from PRD Section 10):**
```javascript
POST /api/auth/signup    → { email, password, name }
POST /api/auth/login     → { email, password }
POST /api/auth/logout
GET  /api/auth/me        → Current user
```

**Security:**
- Hash passwords with bcrypt (salt rounds: 10-12)
- Validate email format
- Validate password strength
- Set JWT expiration (e.g., 7 days)

---

### 5. Recording UI
**Priority:** P0 (Blocker)  
**Dependencies:** Task #1 complete  
**Deliverable:** UI for starting/stopping recordings

**Details:**
- "New Connection" button/modal
- Event context input (event name, location) - optional, can use default
- "Start Recording" button
- Request microphone + camera permissions
- Show recording indicator (visual feedback)
- Live preview of camera feed
- "Stop Recording" button
- "Processing..." state after stopping
- Connect to Anton's WebSocket for audio streaming
- Connect to Magnus's WebSocket for video streaming

**User Flow (from PRD Section 5.2):**
1. User taps "New Connection"
2. Modal asks for event context (optional)
3. User taps "Start Recording"
4. App shows recording indicator + live preview
5. User taps "Stop" when conversation ends
6. App shows "Processing..." state

**WebSocket Connections:**
- Audio stream to Anton: `ws://your-server/livekit`
- Video stream to Magnus: `ws://your-server/overshoot`
- Stream audio chunks (250ms intervals)
- Stream video frames (2 FPS)

**Components Needed:**
- `RecordingModal.jsx` - Modal for starting recording
- `RecordingIndicator.jsx` - Visual indicator during recording
- `CameraPreview.jsx` - Live camera feed
- WebSocket hooks/services for audio/video streaming

---

### 6. Profile Approval UI
**Priority:** P0 (Blocker)  
**Dependencies:** Task #5 complete, Yaw's merge endpoint ready  
**Deliverable:** UI for reviewing and approving profiles

**Details:**
- Display draft profile with all extracted data
- Show confidence scores (highlight low-confidence fields)
- Allow inline editing of any field
- Show visual data: appearance, environment, headshot
- Show audio data: name, company, role, topics, follow-up hooks
- "Approve" button (saves as final profile)
- "Discard" button (deletes draft)
- Loading states during save

**UI Layout (from PRD Section 5.6):**
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
│  [climate tech] [hiring] [+]           │
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

**API Endpoints:**
```javascript
PATCH /api/connections/:id/approve  → Approve with edits
DELETE /api/connections/:id         → Discard draft
```

**Components Needed:**
- `ProfileReview.jsx` - Main review component
- `EditableField.jsx` - Inline editable fields
- `ConfidenceBadge.jsx` - Show confidence scores
- `FollowUpHooks.jsx` - Display and edit follow-up hooks

---

### 7. Connections List (Network Grid)
**Priority:** P0 (Blocker)  
**Dependencies:** Task #6 complete  
**Deliverable:** Grid view of all connections

**Details:**
- Display all approved connections as cards/grid
- Show: name, company, role, event, date, headshot
- Show visual appearance snippet
- Click card to view full profile (navigate to detail view)
- Basic search/filter by name
- Pagination or infinite scroll
- Empty state when no connections

**UI Layout (from PRD Section 5.7):**
```
┌─────────────────────────────────────────┐
│  My Network                    [Search] │
├─────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ [Photo] │  │ [Photo] │  │ [Photo] │ │
│  │ Sarah C │  │ Jake K  │  │ Amy L   │ │
│  │ Stripe  │  │ a16z    │  │ Cohere  │ │
│  │ Jan 17  │  │ Jan 17  │  │ Jan 16  │ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘
```

**API Endpoint:**
```javascript
GET /api/connections?search=&event=&limit=&offset=
```

**Components Needed:**
- `ConnectionsGrid.jsx` - Main grid component
- `ConnectionCard.jsx` - Individual connection card
- `SearchBar.jsx` - Search/filter input
- `EmptyState.jsx` - No connections message

---

### 8. Connection Detail View
**Priority:** P1 (Important)  
**Dependencies:** Task #7 complete  
**Deliverable:** Full profile view page

**Details:**
- Display full profile information
- Show all conversation topics
- Show follow-up hooks with completion status
- Show interaction history
- Edit profile button
- Back button to connections list
- Headshot display
- Appearance and environment descriptions

**UI Layout (from PRD Section 5.8):**
```
┌─────────────────────────────────────────┐
│  ← Back                        [Edit]   │
├─────────────────────────────────────────┤
│  ┌────────┐                             │
│  │  [Photo]│  Sarah Chen                 │
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
│                                         │
│  🎯 FOLLOW-UP HOOKS                     │
│  ☐ Send McKinsey climate report         │
│  ☐ Intro to Marcus (climate VC)        │
│                                         │
│  [Follow Up]                            │
└─────────────────────────────────────────┘
```

**API Endpoint:**
```javascript
GET /api/connections/:id
```

**Components Needed:**
- `ConnectionDetail.jsx` - Main detail component
- `ProfileHeader.jsx` - Header with photo and name
- `TopicsList.jsx` - Display topics
- `FollowUpHooks.jsx` - Display follow-up hooks
- `InteractionHistory.jsx` - Show past interactions

---

### 9. Connect Frontend to WebSocket Endpoints
**Priority:** P0 (Blocker)  
**Dependencies:** Tasks #5, Anton's endpoint ready, Magnus's endpoint ready  
**Deliverable:** Real-time data streaming working

**Details:**
- Set up WebSocket client connections
- Connect to Anton's audio endpoint
- Connect to Magnus's video endpoint
- Stream audio chunks (250ms intervals)
- Stream video frames (2 FPS)
- Handle connection errors
- Handle reconnection logic
- Display real-time updates in UI (transcript, face detection)

**WebSocket Libraries:**
- Native WebSocket API or
- `socket.io-client` or
- `ws` (Node.js) for server-side proxying

**Integration Points:**
- Anton's endpoint: `ws://your-server/livekit`
- Magnus's endpoint: `ws://your-server/overshoot`

---

## PHASE 2 - STRETCH TASKS

### 10. Voice Agent UI
**Priority:** P2 (Stretch)  
**Dependencies:** Phase 1 complete, Anton's voice agent ready  
**Deliverable:** UI for voice queries

**Details:**
- Mic button for voice input
- Visual feedback during recording
- Display search results
- Show spoken response (if using Eleven Labs TTS)
- Handle loading states

**Components Needed:**
- `VoiceSearch.jsx` - Voice input component
- `SearchResults.jsx` - Display search results

---

### 11. Analytics Dashboard
**Priority:** P2 (Stretch)  
**Dependencies:** Phase 1 complete, Yaw's analytics endpoints ready  
**Deliverable:** Dashboard with charts and metrics

**Details:**
- Display metrics: total connections, this month, pending follow-ups
- Charts: connections by industry, over time, top events
- Use charting library (Chart.js, Recharts, etc.)

**API Endpoints:**
```javascript
GET /api/analytics/overview
GET /api/analytics/industry-breakdown
GET /api/analytics/connections-over-time
```

---

### 12. Follow-up Suggestions UI
**Priority:** P2 (Stretch)  
**Dependencies:** Phase 1 complete, Yaw's follow-up endpoint ready  
**Deliverable:** UI showing suggested follow-ups

**Details:**
- List of connections needing follow-up
- Show suggested message
- One-click copy to clipboard
- Mark as complete
- Link to connection profile

**API Endpoints:**
```javascript
GET  /api/followups/pending
GET  /api/followups/:connectionId/suggestion
POST /api/followups/:connectionId/complete
```

---

### 13. Network Graph Visualization
**Priority:** P3 (Nice-to-have)  
**Dependencies:** Phase 1 complete  
**Deliverable:** Interactive network graph

**Details:**
- Visual graph of all connections
- Filter by industry, event, time, tags
- Click node to see profile
- Cluster by common attributes
- Use D3.js or react-force-graph

---

## Deliverables Summary

### Frontend (React)
- ✅ React app with routing
- ✅ Authentication flow (signup/login)
- ✅ Recording UI with WebSocket connections
- ✅ Profile approval/editing UI
- ✅ Connections list (grid view)
- ✅ Connection detail view
- ✅ Responsive design (mobile-first)

### Backend (Express)
- ✅ Express server with all API endpoints
- ✅ MongoDB connection setup
- ✅ Authentication endpoints
- ✅ Protected routes middleware
- ✅ Error handling

### API Endpoints (from PRD Section 10)
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/connections/merge
GET    /api/connections
GET    /api/connections/:id
PATCH  /api/connections/:id/approve
DELETE /api/connections/:id
```

---

## Dependencies on Other Team Members

### Needs from Anton:
- WebSocket endpoint URL for audio streaming
- Event schema documentation
- Real-time transcript updates (for UI display)

### Needs from Magnus:
- WebSocket endpoint URL for video streaming
- Event schema documentation
- Face detection updates (for UI display)
- Headshot images for profile display

### Needs from Yaw:
- API endpoint contracts
- MongoDB schema (for understanding data structure)
- Merge endpoint URL
- All other API endpoints

### Provides to Anton:
- Audio stream from device
- WebSocket connection
- UI for displaying transcript

### Provides to Magnus:
- Video frames from device
- WebSocket connection
- UI for displaying visual data

### Provides to Yaw:
- User authentication (user IDs for connections)
- API requests to all endpoints
- User context for queries

---

## Testing Checklist

- [ ] React app builds and runs
- [ ] Express server starts
- [ ] MongoDB connection works
- [ ] User can sign up
- [ ] User can log in
- [ ] Protected routes work
- [ ] Recording UI works
- [ ] WebSocket connections to Anton/Magnus work
- [ ] Audio/video streaming works
- [ ] Profile approval UI displays data correctly
- [ ] User can edit and approve profiles
- [ ] Connections list displays correctly
- [ ] Search/filter works
- [ ] Connection detail view works
- [ ] Navigation between pages works
- [ ] Responsive design works on mobile
- [ ] Error handling works (network errors, etc.)

---

## Key Files to Create/Modify

### Frontend
```
frontend/
  src/
    App.jsx
    main.jsx
    pages/
      Login.jsx
      Signup.jsx
      Dashboard.jsx
      Connections.jsx
      ConnectionDetail.jsx
      ProfileReview.jsx
    components/
      RecordingModal.jsx
      ConnectionCard.jsx
      ProfileHeader.jsx
      ...
    services/
      api.js
      websocket.js
      auth.js
    hooks/
      useAuth.js
      useWebSocket.js
```

### Backend
```
backend/
  src/
    index.js
    routes/
      index.js
      authRoutes.js
      connectionRoutes.js
    controllers/
      authController.js
      userController.js
    models/
      User.js
    middleware/
      auth.js
      errorHandler.js
    config/
      database.js
```

---

## Notes

- **MongoDB Atlas**: Set up early (Hour 0-2)
- **Environment Variables**: Create `.env` files for frontend and backend
- **CORS**: Configure CORS properly for frontend-backend communication
- **WebSocket**: Test WebSocket connections early with mock data
- **Error Handling**: Plan for network issues, API failures, WebSocket disconnections
- **Mobile First**: Design for mobile, then scale up
- **Loading States**: Show loading indicators for all async operations
- **Error Messages**: User-friendly error messages
- **Authentication**: Secure JWT storage (httpOnly cookies preferred)
- **Performance**: Optimize image loading, lazy load connections list

---

## Quick Start Checklist

1. ✅ Initialize React project
2. ✅ Initialize Express server
3. ✅ Set up MongoDB Atlas connection
4. ✅ Create User model
5. ✅ Implement authentication
6. ✅ Build recording UI
7. ✅ Connect WebSockets
8. ✅ Build profile approval UI
9. ✅ Build connections list
10. ✅ Build connection detail view

---

**Good luck! You're building the entire user experience. 🎨**
