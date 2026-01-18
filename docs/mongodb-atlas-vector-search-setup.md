# MongoDB Atlas Vector Search Setup

This document provides step-by-step instructions for configuring MongoDB Atlas Vector Search for face recognition in NexHacks.

## Prerequisites

- MongoDB Atlas M10 or higher cluster (Vector Search requires a dedicated cluster)
- `connections` collection with the updated schema including `visual.face_embedding`

## Step-by-Step Setup

### 1. Navigate to Atlas Search

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Select your project and cluster
3. Click on **"Search"** in the left navigation panel under "Data Services"

### 2. Create Vector Search Index

1. Click **"Create Search Index"**
2. Select **"Atlas Vector Search"** (not regular Atlas Search)
3. Click **"Next"**

### 3. Configure the Index

1. **Select your database and collection:**
   - Database: `nexhacks` (or your database name)
   - Collection: `connections`

2. **Index Name:** Enter `face_vector_index`

3. **Index Definition:** Click "JSON Editor" and paste:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "visual.face_embedding",
      "numDimensions": 128,
      "similarity": "cosine"
    }
  ]
}
```

4. Click **"Create Search Index"**

### 4. Wait for Index Build

The index will take a few minutes to build depending on your data size. You can monitor progress on the Search page.

### 5. Verify Index is Active

Once the status shows "Active", the index is ready to use.

## Index Configuration Explained

| Field | Value | Description |
|-------|-------|-------------|
| `type` | `vector` | Specifies this is a vector search index |
| `path` | `visual.face_embedding` | The field path containing face embeddings |
| `numDimensions` | `128` | face-api.js generates 128-dimensional embeddings |
| `similarity` | `cosine` | Cosine similarity for normalized face embeddings |

## Usage in Application

The `faceMatching.js` service uses this index via MongoDB aggregation pipeline:

```javascript
await Connection.aggregate([
  {
    $match: {
      user_id: userId,
      status: "approved",
      'visual.face_embedding.0': { $exists: true }
    }
  },
  {
    $vectorSearch: {
      queryVector: faceEmbedding,
      path: "visual.face_embedding",
      numCandidates: 10,
      limit: 3,
      index: "face_vector_index"
    }
  }
]);
```

## Fallback Behavior

If Atlas Vector Search is not configured or fails, the application falls back to brute-force cosine similarity calculation. This works for small datasets but is not recommended for production with large numbers of connections.

## Troubleshooting

### "Index not found" error
- Verify the index name matches exactly: `face_vector_index`
- Ensure the index status is "Active"

### Slow searches
- Check that your cluster is M10 or higher
- Consider increasing `numCandidates` for better accuracy

### No matches returned
- Verify embeddings are 128-dimensional arrays of numbers
- Check that connections have `status: "approved"`
- Ensure `visual.face_embedding` is populated

## Thresholds (Simplified MVP)

| Score Range | Action |
|-------------|--------|
| ≥ 0.80 | Match found - auto-update existing connection |
| < 0.80 | No match - create new connection |

**Workflow:**
1. Extract face embedding from video
2. Search MongoDB for matching faces (vector search)
3. If match score ≥ 0.80: Update existing connection, add new interaction
4. If match score < 0.80: Create new draft connection

These thresholds can be adjusted in `backend/src/services/faceMatching.js` (MATCH_THRESHOLD constant).
