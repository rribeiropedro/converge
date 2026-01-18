# MongoDB Schema Documentation

## NexHacks Database Structure

This document outlines the schema for the MongoDB collections used in the NexHacks application. It includes field types, validation rules, relationships, and indexing strategies.

---

## 1. Collection: `users`

Stores user authentication and profile information.

```javascript
{
  _id: ObjectId,             // Unique identifier for the user
  email: String,             // User's email address (must be unique)
  password_hash: String,     // Hashed password for security
  name: String,              // User's full name
  created_at: Date,          // Timestamp of user creation
  settings: {
    default_event: String | null, // User's preferred default event name
    voice_agent_enabled: Boolean  // Flag to enable/disable voice agent features
  },
  // Additional fields as needed for user management
}
```

**Indexes:**
- `email`: Unique index to ensure no duplicate email addresses.

---

## 2. Collection: `connections`

Stores details about professional connections, merged from audio and visual processing.

```javascript
{
  _id: ObjectId,             // Unique identifier for the connection
  user_id: ObjectId,         // Reference to the `users` collection (who owns this connection)
  status: String,            // "draft" | "approved" | "archived" (Lifecycle status of the profile)
  
  // Identity (from Audio Processing - LiveKit)
  name: { 
    value: String,           // Extracted name
    confidence: String,      // "high" | "medium" | "low"
    source: String           // "livekit" | "manual"
  },
  company: { 
    value: String,           // Extracted company
    confidence: String,      // "high" | "medium" | "low"
    source: String           // "livekit" | "manual"
  },
  role: { 
    value: String,           // Extracted role/job title
    confidence: String,      // "high" | "medium" | "low"
    source: String           // "livekit" | "manual"
  },
  
  // Visual Data (from Video Processing - Overshoot)
  visual: {
    face_embedding: [Number],  // 512-dimensional vector for face recognition/similarity
    appearance: {
      description: String,     // Natural language description of appearance
      distinctive_features: [String] // Key visual features (e.g., "glasses", "red lanyard")
    },
    environment: {
      description: String,     // Natural language description of the meeting environment
      landmarks: [String]      // Key landmarks in the environment (e.g., "coffee station")
    },
    headshot: {                // Optional headshot image
      url: String,             // URL to hosted image
      base64: String           // Base64 encoded image (for temporary or small images, consider GridFS for larger)
    }
  },
  
  // Audio Data (from Audio Processing - LiveKit)
  audio: {
    topics_discussed: [String], // Key discussion topics
    their_challenges: [String], // Challenges or problems they mentioned
    follow_up_hooks: [{         // Actionable follow-up points
      type: String,             // "resource_share" | "intro_request" | "meeting" | "other"
      detail: String,           // Specific detail of the follow-up
      completed: Boolean,       // true if follow-up action has been completed
      completed_at: Date | null // Timestamp when follow-up was completed
    }],
    personal_details: [String], // Noteworthy personal information
    transcript_summary: String  // A concise summary of the conversation
  },
  
  // Contextual Data (System-generated or User-provided)
  context: {
    event: { 
      name: String,            // Name of the event where connection was made
      type: String             // "hackathon" | "conference" | "meetup" | "other"
    },
    location: { 
      name: String,            // General location name (e.g., "SF", "Main Hall")
      city: String             // City of the event
    },
    first_met: Date            // Timestamp of the first meeting
  },
  
  // Categorization (User-defined or AI-suggested)
  tags: [String],              // User-defined tags for organization
  industry: String,            // Extracted or manually assigned industry
  relationship_type: String,   // E.g., "acquaintance", "colleague", "mentor"
  
  // Enrichment Data (Stretch Goal - e.g., LinkedIn)
  enrichment: {
    linkedin: { url: String, id: String }, // LinkedIn profile URL and ID
    experience: [{
      title: String,
      company: String,
      start_date: Date,
      end_date: Date | null,
      description: String
    }],
    education: [{
      degree: String,
      institution: String,
      start_date: Date,
      end_date: Date | null
    }],
    skills: [String]
  },
  
  // Metadata & Review Flags
  needs_review: Boolean,       // True if critical fields have low confidence
  fields_needing_review: [String], // List of specific fields (e.g., "name", "role") needing review
  interaction_count: Number,   // Total number of interactions with this connection
  last_interaction: Date,      // Timestamp of the most recent interaction
  last_contacted: Date | null, // Timestamp of the last outbound contact
  created_at: Date,            // Timestamp of connection creation in DB
  updated_at: Date             // Timestamp of last update
}
```

**Indexes:**
- **Text Search Index:**
  ```javascript
  db.connections.createIndex({
    "name.value": "text",
    "company.value": "text",
    "audio.topics_discussed": "text",
    "audio.transcript_summary": "text",
    "visual.appearance.description": "text",
    "visual.environment.description": "text",
    "tags": "text"
  });
  ```
- **Vector Search Index (Atlas UI Configuration):**
  - Index Name: `face_vector_index`
  - Path: `visual.face_embedding`
  - Dimensions: 512
  - Similarity: `cosine`
  *(Note: This index must be created manually in the MongoDB Atlas UI.)*
- **Compound Indexes:**
  ```javascript
  db.connections.createIndex({ user_id: 1, status: 1 }); // For filtering user's connections by status
  db.connections.createIndex({ user_id: 1, "context.event.name": 1 }); // For filtering by event
  db.connections.createIndex({ user_id: 1, "context.first_met": -1 }); // For sorting by date met (descending)
  ```

---

## 3. Collection: `interactions`

Records each individual interaction or meeting with a connection.

```javascript
{
  _id: ObjectId,             // Unique identifier for the interaction
  user_id: ObjectId,         // Reference to the `users` collection (who initiated interaction)
  connection_id: ObjectId,   // Reference to the `connections` collection (with whom the interaction was)
  type: String,              // "first_meeting" | "follow_up" | "meeting" | "call" | "email"
  timestamp: Date,           // Exact time of the interaction
  duration_seconds: Number,  // Duration of the interaction
  transcript_summary: String,// Summary of what was discussed during this specific interaction
  visual_snapshot: {         // Snapshot of visual context during interaction
    appearance_at_time: String, // Description of appearance at time of interaction
    environment_at_time: String // Description of environment at time of interaction
  },
  created_at: Date           // Timestamp of interaction record creation
}
```

**Indexes:**
```javascript
db.interactions.createIndex({ connection_id: 1, timestamp: -1 }); // To quickly retrieve interactions for a specific connection, sorted by most recent
```

---

## 4. Collection: `events`

Manages details about networking events.

```javascript
{
  _id: ObjectId,             // Unique identifier for the event
  user_id: ObjectId,         // Reference to the `users` collection (who attended/created the event)
  name: String,              // Name of the event (e.g., "NexHacks 2026")
  type: String,              // "hackathon" | "conference" | "meetup" | "other"
  location: { 
    name: String,            // General location name
    city: String             // City where event took place
  },
  date_start: Date,          // Start date of the event
  date_end: Date,            // End date of the event
  connection_count: Number   // Total connections made by the user at this event
}
```

**Indexes:**
- `user_id`: To quickly fetch all events associated with a user.
- `name`: For searching/filtering events by name.
