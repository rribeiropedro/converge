# Yaw - Schema + Agent + Backend Logic Tasks

## Overview
Yaw is responsible for **database design, data processing logic, and backend intelligence**. You design the MongoDB schema, create indexes for efficient queries, build the profile merge endpoint, implement confidence scoring, and handle all the backend logic that makes the system intelligent.

---

## How This Connects to Overall Features

### Core Backend Logic
Your work directly enables:
- **Profile Merging (5.5)**: Combine audio + visual data into unified profiles
- **Profile Approval (5.6)**: Determine which fields need review
- **Connections List (5.7)**: Query and filter connections efficiently
- **Voice Agent Search (7.1)**: Parse queries and search MongoDB
- **Analytics Dashboard (7.2)**: Aggregate data for insights
- **Follow-up Suggestions (7.3)**: Generate smart follow-up recommendations

### Data Flow
```
Anton (audio) + Magnus (visual) → Your merge endpoint → MongoDB
User queries → Your search logic → MongoDB → Results
Analytics requests → Your aggregations → MongoDB → Charts
```

---

## PHASE 1 - CORE TASKS

### 1. Design MongoDB Schema
**Priority:** P0 (Blocker)  
**Dependencies:** None (but coordinate with team)  
**Deliverable:** Complete schema documentation

**Details:**
- Design all collections: `users`, `connections`, `interactions`, `events`
- Define field types, validation rules, relationships
- Document schema in `docs/db_structure.md` (per user rules)
- Ensure schema supports all features from PRD

**Collections to Design (from PRD Section 11):**

**users:**
```javascript
{
  _id: ObjectId,
  email: String (unique),
  password_hash: String,
  name: String,
  created_at: Date,
  settings: {
    default_event: String | null,
    voice_agent_enabled: Boolean
  }
}
```

**connections:**
```javascript
{
  _id: ObjectId,
  user_id: ObjectId (ref: users),
  status: String ("draft" | "approved" | "archived"),
  
  // Identity
  name: { value: String, confidence: String, source: String },
  company: { value: String, confidence: String, source: String },
  role: { value: String, confidence: String, source: String },
  
  // Visual (from Magnus)
  visual: {
    face_embedding: [Number],  // 512-dim vector
    appearance: {
      description: String,
      distinctive_features: [String]
    },
    environment: {
      description: String,
      landmarks: [String]
    },
    headshot: {
      url: String,
      base64: String  // or store in GridFS
    }
  },
  
  // Audio (from Anton)
  audio: {
    topics_discussed: [String],
    their_challenges: [String],
    follow_up_hooks: [{
      type: String,
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
  
  // Metadata
  needs_review: Boolean,
  fields_needing_review: [String],
  interaction_count: Number,
  last_interaction: Date,
  created_at: Date,
  updated_at: Date
}
```

**interactions:**
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  connection_id: ObjectId,
  type: String,
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

**events:**
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  name: String,
  type: String,
  location: { name: String, city: String },
  date_start: Date,
  date_end: Date,
  connection_count: Number
}
```

**Deliverable:**
- Create `docs/db_structure.md` with full schema
- Create Mongoose models for all collections
- Document relationships and constraints

---

### 2. Create MongoDB Indexes (Text + Vector)
**Priority:** P0 (Blocker)  
**Dependencies:** Task #1 complete  
**Deliverable:** All indexes created and tested

**Details:**
- Create text search index for connections
- Create vector search index for face embeddings
- Create compound indexes for common queries
- Test query performance

**Text Search Index (from PRD Section 11):**
```javascript
db.connections.createIndex({
  "name.value": "text",
  "company.value": "text",
  "audio.topics_discussed": "text",
  "audio.transcript_summary": "text",
  "visual.appearance.description": "text",
  "visual.environment.description": "text",
  "tags": "text"
})
```

**Vector Search Index (Atlas UI):**
- Index name: `face_vector_index`
- Path: `visual.face_embedding`
- Dimensions: 512
- Similarity: cosine

**Compound Indexes:**
```javascript
// For user's connections list
db.connections.createIndex({ user_id: 1, status: 1 })

// For filtering by event
db.connections.createIndex({ user_id: 1, "context.event.name": 1 })

// For sorting by date
db.connections.createIndex({ user_id: 1, "context.first_met": -1 })

// For interactions
db.interactions.createIndex({ connection_id: 1, timestamp: -1 })
```

**Implementation:**
- Create indexes via Mongoose schema or MongoDB shell
- Document index strategy in `db_structure.md`
- Test query performance

---

### 3. Build Profile Merge Endpoint
**Priority:** P0 (Blocker)  
**Dependencies:** Tasks #1, #2 complete, Anton's output ready, Magnus's output ready  
**Deliverable:** Working merge endpoint

**Details:**
- Create `POST /api/connections/merge` endpoint
- Accept audio data from Anton
- Accept visual data from Magnus
- Merge into unified profile structure
- Add system context (timestamp, user_id, etc.)
- Calculate confidence scores
- Determine fields needing review
- Save to MongoDB as draft
- Return merged profile

**Merge Logic (from PRD Section 5.5):**
```javascript
function mergeProfile(audioData, visualData, context) {
  return {
    user_id: context.userId,
    status: 'draft',
    
    // From Anton (LiveKit)
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
    
    // From Magnus (Overshoot)
    visual: {
      face_embedding: visualData.face_embedding,
      appearance: visualData.appearance,
      environment: visualData.environment,
      headshot: visualData.headshot  // NEW
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

**API Endpoint:**
```javascript
POST /api/connections/merge
Body: {
  audio: { /* Anton's output */ },
  visual: { /* Magnus's output */ },
  context: {
    event: { name: String, type: String },
    location: { name: String, city: String }
  }
}
Response: {
  _id: String,
  status: "draft",
  /* merged profile */
}
```

**Integration Points:**
- Pedro calls this after recording stops
- Anton provides audio data
- Magnus provides visual data
- Returns draft profile for Pedro's approval UI

---

### 4. Implement Confidence Scoring Logic
**Priority:** P0 (Blocker)  
**Dependencies:** Task #3 complete  
**Deliverable:** Confidence calculation working

**Details:**
- Analyze confidence scores from Anton's audio extraction
- Combine with visual data confidence (if available)
- Calculate overall field confidence
- Determine which fields need manual review
- Set `needs_review` flag on connection
- Populate `fields_needing_review` array

**Logic:**
```javascript
function calculateNeedsReview(audioData) {
  // If any critical field has low confidence, needs review
  const criticalFields = ['name', 'company'];
  return criticalFields.some(field => 
    audioData.profile[field]?.confidence === 'low'
  ) || audioData.profile.role?.confidence === 'low';
}

function getFieldsNeedingReview(audioData) {
  const fields = [];
  Object.keys(audioData.profile).forEach(field => {
    if (audioData.profile[field]?.confidence === 'low' || 
        audioData.profile[field]?.confidence === 'medium') {
      fields.push(field);
    }
  });
  return fields;
}
```

**Integration Point:**
- Pedro's approval UI highlights low-confidence fields
- Users can edit before approving

---

### 5. Implement Review Fields Logic
**Priority:** P0 (Blocker)  
**Dependencies:** Task #4 complete  
**Deliverable:** Review flagging working

**Details:**
- Determine which fields need review based on confidence
- Mark fields with visual indicators in UI
- Allow users to edit fields before approval
- Track which fields were manually edited

**Fields That Always Need Review:**
- Low confidence fields
- Medium confidence fields (optional)
- Fields with conflicting data (audio vs visual)

**Implementation:**
- Set `needs_review: true` if any critical field is low confidence
- Populate `fields_needing_review` array
- Pedro's UI uses this to highlight fields

---

### 6. End-to-End Testing with Mock Data
**Priority:** P0 (Blocker)  
**Dependencies:** All above tasks complete  
**Deliverable:** Full flow tested

**Details:**
- Create mock audio data (simulating Anton's output)
- Create mock visual data (simulating Magnus's output)
- Test merge endpoint with mock data
- Test confidence scoring
- Test review logic
- Test saving to MongoDB
- Test querying connections
- Test all API endpoints

**Mock Data:**
```javascript
const mockAudioData = {
  transcript: "Hi, I'm Sarah Chen from Stripe...",
  profile: {
    name: { value: "Sarah Chen", confidence: "high" },
    company: { value: "Stripe", confidence: "high" },
    role: { value: "Climate Team Lead", confidence: "medium" }
  },
  topics_discussed: ["climate tech", "hiring"],
  their_challenges: ["Looking for UX designer"],
  follow_up_hooks: [{ type: "resource_share", detail: "Send report" }],
  personal_details: ["Has a dog named Pixel"]
};

const mockVisualData = {
  face_embedding: Array(512).fill(0).map(() => Math.random()),
  appearance: {
    description: "Blue blazer, short dark hair, glasses",
    distinctive_features: ["glasses", "red lanyard"]
  },
  environment: {
    description: "By the coffee station near main stage",
    landmarks: ["coffee station", "Stripe booth"]
  },
  headshot: {
    url: "https://...",
    base64: "data:image/jpeg;base64,..."
  }
};
```

---

## PHASE 2 - STRETCH TASKS

### 7. Voice Query Parsing (LLM)
**Priority:** P2 (Stretch)  
**Dependencies:** Phase 1 complete, Anton's voice agent ready  
**Deliverable:** Natural language to MongoDB query conversion

**Details:**
- Receive voice transcript from Anton
- Use LLM (Anthropic/Claude) to parse query intent
- Extract search filters: company, role, event, appearance, time range
- Convert to MongoDB query
- Execute query and return results

**Query Types (from PRD Section 7.1):**
```
"Who was the scout from a16z?" 
→ { company: "a16z", role: "scout" }

"Person in blue shirt by Stripe booth"
→ { appearance: "blue shirt", environment: "Stripe booth" }

"Everyone I met at NexHacks who works in AI"
→ { event: "NexHacks", topics: "AI" }

"Who did I meet yesterday?"
→ { time_range: "yesterday" }
```

**LLM Prompt:**
```
Parse this user query into MongoDB search filters:
Query: "{user_query}"

Extract:
- company: company name mentioned
- role: job title/role mentioned
- event: event name mentioned
- appearance: appearance description
- environment: location/landmark mentioned
- time_range: time reference (yesterday, last week, etc.)
- topics: topics/industries mentioned

Return JSON with extracted filters.
```

**API Endpoint:**
```javascript
POST /api/search/voice
Body: { transcript: "Who was the scout from a16z?" }
Response: {
  parsed_query: { company: "a16z", role: "scout" },
  results: [ /* matching connections */ ],
  spoken_response: "I found Jake Kim..."
}
```

---

### 8. Analytics Aggregations
**Priority:** P2 (Stretch)  
**Dependencies:** Phase 1 complete  
**Deliverable:** Analytics endpoints with MongoDB aggregations

**Details:**
- Create aggregation pipelines for analytics
- Calculate: total connections, this month, pending follow-ups
- Group by: industry, event, time period
- Generate charts data

**Endpoints (from PRD Section 7.2):**
```javascript
GET /api/analytics/overview
→ {
    total_connections: 47,
    connections_this_month: 12,
    pending_follow_ups: 8,
    events_attended: 5
  }

GET /api/analytics/industry-breakdown
→ [{ industry: "AI", count: 15 }, ...]

GET /api/analytics/connections-over-time
→ [{ date: "2026-01-17", count: 5 }, ...]

GET /api/analytics/top-events
→ [{ event: "NexHacks", count: 20 }, ...]
```

**MongoDB Aggregation Example:**
```javascript
// Connections by industry
db.connections.aggregate([
  { $match: { user_id: userId, status: "approved" } },
  { $group: { _id: "$industry", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

---

### 9. Follow-up Suggestion Generation (LLM)
**Priority:** P2 (Stretch)  
**Dependencies:** Phase 1 complete  
**Deliverable:** AI-generated personalized follow-up messages

**Details:**
- Find connections needing follow-up
- Generate personalized message using LLM
- Reference conversation context
- Match user's resources to connection's interests
- Return suggested message

**Logic (from PRD Section 7.3):**
1. Find connections with incomplete follow-up hooks
2. Find connections met 3-14 days ago with no follow-up
3. Rank by urgency (promised actions first)
4. Generate personalized message

**LLM Prompt:**
```
Generate a personalized follow-up message for this connection:

Connection: {name} from {company}
Met at: {event} on {date}
Topics discussed: {topics}
Follow-up hook: {follow_up_hook}
Personal details: {personal_details}

Write a warm, authentic message that:
- References the conversation
- Addresses the follow-up hook naturally
- Feels personal, not generic
- Is 2-3 sentences
```

**API Endpoints:**
```javascript
GET  /api/followups/pending
→ [{ connection_id, connection_name, suggested_message, reason }]

GET  /api/followups/:connectionId/suggestion
→ { suggested_message: "Hi Sarah! Great meeting..." }

POST /api/followups/:connectionId/complete
→ { completed: true }
```

---

### 10. LinkedIn Enrichment Integration
**Priority:** P3 (Nice-to-have)  
**Dependencies:** Phase 1 complete  
**Deliverable:** LinkedIn profile data enrichment

**Details:**
- Search LinkedIn by name + company
- Match using face embedding (if multiple candidates)
- Pull: work history, education, skills, photo
- Update connection profile with enriched data
- Manual LinkedIn URL entry as fallback

**API Endpoints:**
```javascript
POST /api/connections/:id/enrich
→ Searches and enriches automatically

POST /api/connections/:id/enrich/manual
Body: { linkedin_url: "https://linkedin.com/in/..." }
→ Enriches from provided URL
```

**Integration:**
- Use Proxycurl API (~$0.03/profile) or
- Manual URL entry for hackathon

---

## Deliverables Summary

### MongoDB Schema
- ✅ Complete schema documentation (`docs/db_structure.md`)
- ✅ Mongoose models for all collections
- ✅ Indexes (text, vector, compound)

### API Endpoints
```
POST   /api/connections/merge
GET    /api/connections
GET    /api/connections/:id
PATCH  /api/connections/:id/approve
DELETE /api/connections/:id
POST   /api/search/voice (stretch)
GET    /api/analytics/* (stretch)
GET    /api/followups/* (stretch)
```

### Logic & Processing
- ✅ Profile merge logic
- ✅ Confidence scoring
- ✅ Review field determination
- ✅ Query parsing (stretch)
- ✅ Analytics aggregations (stretch)
- ✅ Follow-up generation (stretch)

---

## Dependencies on Other Team Members

### Needs from Anton:
- Audio output schema (already in PRD Section 5.3)
- WebSocket event structure
- Confidence score format

### Needs from Magnus:
- Visual output schema (already in PRD Section 5.4)
- WebSocket event structure
- Face embedding format (512 dimensions)
- Headshot image format

### Needs from Pedro:
- User authentication (user IDs)
- API endpoint requirements
- Data format preferences

### Provides to Pedro:
- All API endpoints
- API documentation
- Data structure documentation
- Error handling guidance

### Provides to Anton & Magnus:
- Expected input schema for merge endpoint
- MongoDB structure for storing their data

---

## Testing Checklist

- [ ] MongoDB schema created and tested
- [ ] All indexes created and working
- [ ] Text search works
- [ ] Vector search works (test with sample embeddings)
- [ ] Merge endpoint accepts Anton + Magnus data
- [ ] Merge logic combines data correctly
- [ ] Confidence scoring works
- [ ] Review logic flags correct fields
- [ ] Connections save to MongoDB
- [ ] Connections query works
- [ ] Filtering and search work
- [ ] End-to-end test with mock data passes
- [ ] All API endpoints tested
- [ ] Error handling works

---

## Key Files to Create/Modify

```
backend/
  src/
    models/
      User.js (already exists)
      Connection.js
      Interaction.js
      Event.js
    controllers/
      connectionController.js
      searchController.js (stretch)
      analyticsController.js (stretch)
      followupController.js (stretch)
    services/
      mergeService.js
      confidenceService.js
      reviewService.js
      queryParser.js (stretch)
      followupGenerator.js (stretch)
    routes/
      connectionRoutes.js
      searchRoutes.js (stretch)
      analyticsRoutes.js (stretch)
      followupRoutes.js (stretch)
docs/
  db_structure.md
```

---

## Notes

- **MongoDB Atlas**: Coordinate with Pedro for connection setup
- **Schema Design**: Document thoroughly - this is the foundation
- **Indexes**: Critical for performance - test query speeds
- **Vector Search**: Set up in Atlas UI (not via code)
- **LLM APIs**: Get Anthropic API key for query parsing and follow-up generation
- **Error Handling**: Plan for missing data, API failures, invalid formats
- **Performance**: Optimize aggregations, use indexes effectively
- **Testing**: Create comprehensive test data early
- **Documentation**: Keep `db_structure.md` updated per user rules

---

## MongoDB Best Practices

1. **Schema Design**
   - Use embedded documents for related data (visual, audio)
   - Use references (ObjectId) for relationships (user_id)
   - Index frequently queried fields

2. **Indexes**
   - Text index for searchable fields
   - Vector index for face embeddings
   - Compound indexes for common query patterns
   - Don't over-index (slows writes)

3. **Queries**
   - Use `.select()` to limit returned fields
   - Use `.limit()` and `.skip()` for pagination
   - Use aggregation pipeline for complex queries

4. **Vector Search**
   - Set up in Atlas UI (Atlas Search)
   - Use cosine similarity for face matching
   - Test with sample embeddings

---

**Good luck! You're building the intelligence layer. 🧠**
