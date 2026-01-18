# Face Recognition Pipeline Diagram

## Complete Workflow: Conversation → Profile Update/Creation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    USER STARTS CONVERSATION                             │
│                    (Recording begins)                                    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PARALLEL PROCESSING                                   │
│  ┌──────────────────────┐        ┌──────────────────────┐                 │
│  │   AUDIO STREAM       │        │   VIDEO STREAM     │                 │
│  │   (Deepgram)         │        │   (Overshoot)      │                 │
│  │                      │        │                    │                 │
│  │  • Live transcription│        │  • Face detection  │                 │
│  │  • Speaker diarization│       │  • Frame capture  │                 │
│  └──────────┬───────────┘        └──────────┬─────────┘                 │
└─────────────┼───────────────────────────────┼───────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATA EXTRACTION  (LLM)                               │
│  ┌──────────────────────┐        ┌──────────────────────┐             │
│  │   AUDIO PROCESSING    │        │   VISUAL PROCESSING  │             │
│  │   (transcriptParser)  │        │   (visualParser)     │             │
│  │                      │        │                    │                 │
│  │  • Name extraction  │        │  • Face embedding  │                 │
│  │  • Company extraction│        │    (face-api.js)   │                 │
│  │  • Role extraction   │        │    (128-dim vector) │                 │
│  │  • Topics discussed  │        │  • Appearance desc │                 │
│  │  • Follow-up hooks   │        │    (LLM-generated) │                 │
│  │  • Personal details  │        │  • Environment desc │                 │
│  │  • Confidence scores │        │    (LLM-generated) │                 │
│  └──────────┬───────────┘        └──────────┬─────────┘                 │
└─────────────┼───────────────────────────────┼───────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SCHEMA VALIDATION (Zod)                               │
│                                                                          │
│  validateAudioData() & validateVisualData()                             │
│                                                                          │
│  • Validates enum values (confidence, follow_up_hooks types)            │
│  • Validates data types (strings, arrays, numbers)                      │
│  • Applies defaults for missing fields                                  │
│  • Throws detailed errors if invalid                                    │
│                                                                          │
│  ✅ Ensures LLM output aligns with MongoDB schema                       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FACE EMBEDDING CHECK                                  │
│                                                                          │
│  IF: No face embedding generated                                        │
│      └─> Create new draft connection (status: 'draft')                  │
│          └─> Return { type: 'new', draft }                              │
│                                                                          │
│  ELSE: Face embedding exists (128-dim array)                            │
│        └─> Continue to face matching...                                 │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FACE MATCHING (Vector Search)                         │
│                                                                          │
│  findMatchingConnection(userId, faceEmbedding)                           │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  MongoDB Atlas Vector Search Pipeline:                   │           │
│  │                                                           │           │
│  │  1. $vectorSearch (FIRST STAGE - REQUIRED)              │           │
│  │     ├─ index: "face_vector_index"                       │           │
│  │     ├─ path: "visual.face_embedding"                     │           │
│  │     ├─ queryVector: faceEmbedding (128-dim)             │           │
│  │     ├─ numCandidates: 50                                │           │
│  │     ├─ limit: 3                                          │           │
│  │     └─ filter: { user_id, status: "approved" }          │           │
│  │                                                           │           │
│  │  2. $project                                             │           │
│  │     ├─ _id, name, company, visual                        │           │
│  │     └─ score: { "$meta": "vectorSearchScore" }          │           │
│  │                                                           │           │
│  │  Returns: Top 3 matches with similarity scores            │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│  Fallback: If vector search fails                                       │
│            └─> Brute-force cosine similarity calculation                │
│                (works but slower for large datasets)                    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    MATCH SCORE DECISION                                  │
│                                                                          │
│  Filter matches: score >= MATCH_THRESHOLD (0.80)                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │                                                           │           │
│  │  IF: matches.length > 0 AND matches[0].score >= 0.80     │           │
│  │      │                                                    │           │
│  │      ▼                                                    │           │
│  │  ┌────────────────────────────────────────┐             │           │
│  │  │  UPDATE EXISTING CONNECTION             │             │           │
│  │  │  (addInteractionToExistingConnection)  │             │           │
│  │  │                                         │             │           │
│  │  │  • Add face embedding to history       │             │           │
│  │  │  • Merge new topics (deduplicate)      │             │           │
│  │  │  • Add new follow-up hooks              │             │           │
│  │  │  • Update fields if higher confidence   │             │           │
│  │  │  • Increment interaction_count          │             │           │
│  │  │  • Update last_interaction timestamp    │             │           │
│  │  │  • Create Interaction record            │             │           │
│  │  │                                         │             │           │
│  │  │  Return: { type: 'recognized',          │             │           │
│  │  │           connection,                   │             │           │
│  │  │           interaction,                   │             │           │
│  │  │           match_score }                 │             │           │
│  │  └────────────────────────────────────────┘             │           │
│  │                                                           │           │
│  │  ELSE: matches.length === 0 OR matches[0].score < 0.80    │           │
│  │      │                                                    │           │
│  │      ▼                                                    │           │
│  │  ┌────────────────────────────────────────┐             │           │
│  │  │  CREATE NEW CONNECTION                   │             │           │
│  │  │  (createDraftConnection)                  │             │           │
│  │  │                                         │             │           │
│  │  │  • Status: 'draft'                      │             │           │
│  │  │  • Extract all profile fields           │             │           │
│  │  │  • Calculate confidence scores            │             │           │
│  │  │  • Flag fields needing review           │             │           │
│  │  │  • Save face embedding                  │             │           │
│  │  │  • Store appearance/environment         │             │           │
│  │  │                                         │             │           │
│  │  │  Return: { type: 'new', draft }         │             │           │
│  │  └────────────────────────────────────────┘             │           │
│  │                                                           │           │
│  └──────────────────────────────────────────────────────────┘           │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESPONSE TO FRONTEND                                 │
│                                                                          │
│  Type: 'recognized'                                                     │
│  └─> Show: "Recognized [Name]! Added new interaction."                  │
│      └─> Display updated connection profile                             │
│                                                                          │
│  Type: 'new'                                                            │
│  └─> Show: "New connection! Review and approve the profile."           │
│      └─> Display draft profile for user review                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. **Face Embedding Generation**
- **Service**: `faceEmbeddingService.js`
- **Model**: face-api.js (TinyFaceDetector + FaceRecognitionNet)
- **Output**: 128-dimensional vector array
- **Input**: Base64 image or image URL

### 2. **Vector Search**
- **Index**: `face_vector_index` (MongoDB Atlas)
- **Path**: `visual.face_embedding`
- **Similarity**: Cosine similarity
- **Dimensions**: 128
- **Filter**: Only search approved connections for the current user

### 3. **Match Threshold**
- **MATCH_THRESHOLD**: 0.80 (80%)
- **Score >= 0.80**: Update existing connection
- **Score < 0.80**: Create new connection
- **No confirmation step** (simplified MVP)

### 4. **Data Flow**
```
Audio → transcriptParser → audioData
Video → visualParser → visualData (with face_embedding)
     ↓
face_embedding → findMatchingConnection → matches
     ↓
matches[0].score >= 0.80? → Update OR Create
```

## Database Operations

### When Updating Existing Connection:
- ✅ Add to `face_embedding_history` array
- ✅ Merge `topics_discussed` (deduplicate)
- ✅ Append `follow_up_hooks`
- ✅ Update fields if new data has higher confidence
- ✅ Increment `interaction_count`
- ✅ Create new `Interaction` document

### When Creating New Connection:
- ✅ Save as `status: 'draft'`
- ✅ Store all extracted profile data
- ✅ Calculate `needs_review` flags
- ✅ User must approve before it becomes searchable

## Error Handling

1. **No face embedding**: Create new connection (no matching possible)
2. **Vector search fails**: Fallback to brute-force cosine similarity
3. **Invalid embedding**: Return empty matches array
4. **Connection not found**: Throw error (shouldn't happen with proper filtering)

## Performance Notes

- **Vector Search**: Fast for large datasets (uses Atlas index)
- **Brute-force fallback**: Works but slower (O(n) comparison)
- **numCandidates: 50**: Good balance between accuracy and speed
- **limit: 3**: Only return top 3 matches (we only use the best one)

## Code References

- **Main Processing**: `backend/src/services/processingService.js` → `processNewInteraction()`
- **Face Matching**: `backend/src/services/faceMatching.js` → `findMatchingConnection()`
- **Face Embedding**: `backend/src/services/faceEmbeddingService.js` → `generateFaceEmbedding()`
- **Vector Search Index**: MongoDB Atlas → `face_vector_index` on `connections` collection
