# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Converge is an AI-powered personal CRM that captures conversations at networking events and builds a queryable knowledge graph of professional connections. It uses audio transcription (Deepgram) and video analysis (Overshoot) to extract structured profiles from real conversations.

## Tech Stack

- **Frontend**: Next.js 16 + React 18, TypeScript, Tailwind CSS, shadcn/ui (Radix), D3.js for network visualization
- **Backend**: Express.js (ES modules), MongoDB + Mongoose, Socket.IO for real-time transcription
- **AI Services**: Deepgram (live transcription), Anthropic Claude via OpenRouter (profile extraction), face-api.js (face embeddings)
- **Mobile**: Separate React app in `converge-mobile/` for Overshoot SDK video capture

## Commands

```bash
# Install all dependencies (root, backend, frontend)
npm run install:all

# Run both frontend and backend concurrently
npm run dev

# Run individually
npm run dev:backend    # Express on port 3001 (nodemon)
npm run dev:frontend   # Next.js on port 3000

# Frontend only
cd frontend && npm run dev      # Development
cd frontend && npm run build    # Production build
cd frontend && npm run lint     # ESLint

# Backend only
cd backend && npm run dev       # With nodemon
cd backend && npm start         # Without nodemon
```

## Architecture

### Backend (`backend/src/`)

```
index.js                    # Server entry, Socket.IO setup, route mounting
routes/
  index.js                  # Route aggregator: /api/users, /api/transcribe, /api/connections
  transcribeRoutes.js       # POST /batch (file upload), live transcription via Socket.IO
  connectionRoutes.js       # CRUD for Connection profiles
  overshootRoutes.js        # POST /overshoot-result, /generate-headshot
realtime/
  transcribeSocket.js       # Socket.IO namespace /api/transcribe/live for Deepgram streaming
services/
  transcriptParser.js       # OpenRouter → Claude for profile extraction from transcripts
  faceEmbeddingService.js   # face-api.js for 128-dim embeddings, cosine similarity
  visualParser.js           # OpenRouter → Claude for appearance/environment from Overshoot
controllers/
  transcribeController.js   # Deepgram SDK integration
models/
  Connection.js             # Main data model: profile fields with confidence scores, audio/visual data
  User.js, Event.js, Interaction.js
```

### Frontend (`frontend/`)

```
app/                        # Next.js App Router
  page.tsx                  # Landing page
  auth/                     # Authentication flow
  dashboard/                # Network graph view, profile management
  agent/                    # AI chat interface for querying network
  profile/                  # Connection profile detail/edit
components/
  network-graph.tsx         # D3.js force-directed graph visualization
  filter-panel.tsx          # Date/location/industry filters
  node-preview-card.tsx     # Connection hover preview
  ui/                       # shadcn/ui components
lib/
  data.ts                   # Mock data, type definitions
```

### Key Data Model: Connection

Connection profiles have fields with confidence scores and sources:
```javascript
{
  name: { value: string, confidence: 'high'|'medium'|'low', source: 'livekit'|'manual' },
  company: { value, confidence, source },
  visual: { face_embedding: number[128], appearance, environment, headshot },
  audio: { topics_discussed, their_challenges, follow_up_hooks, transcript_summary },
  context: { event: { name, type }, location: { name, city }, first_met }
}
```

### Real-time Transcription Flow

1. Client connects to Socket.IO namespace `/api/transcribe/live`
2. Emits `start` with options (model, language, diarize)
3. Streams audio chunks via `audio` event
4. Receives `transcript` events with { transcript, words, speaker, is_final }
5. Final transcripts sent to `transcriptParser.js` for profile extraction

## Environment Variables

Backend requires in `backend/.env`:
- `MONGODB_URI` - MongoDB connection string
- `DEEPGRAM_API_KEY` - For live transcription
- `OPEN_ROUTER_API_KEY` - For Claude profile extraction
- `PORT` - Server port (default 3001)
- `CLIENT_URL` - CORS origin (default http://localhost:3000)

## Key Integration Points

- **Deepgram**: `controllers/transcribeController.js` creates live connections
- **OpenRouter/Claude**: `services/transcriptParser.js` and `services/visualParser.js`
- **Face-API**: `services/faceEmbeddingService.js` - models must be in `backend/face-api-models/`
- **Overshoot**: `converge-mobile/` handles video capture, results posted to `/api/overshoot-result`

## Face API Models

Download face-api.js models before using face embedding features:
```bash
./download-face-models.sh
```
Models go to `backend/face-api-models/`
