# API Testing with cURL

Base URL: `http://localhost:5000`

## Health Check Endpoints

### GET /health
```bash
curl -X GET http://localhost:5000/health
```

### GET /api/health
```bash
curl -X GET http://localhost:5000/api/health
```

### GET / (Root endpoint - API info)
```bash
curl -X GET http://localhost:5000/
```

---

## User Endpoints

### GET /api/users - Get all users
```bash
curl -X GET http://localhost:5000/api/users
```

### GET /api/users/:id - Get user by ID
```bash
# Replace USER_ID with actual MongoDB ObjectId
curl -X GET http://localhost:5000/api/users/USER_ID
```

### POST /api/users - Create new user
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com"
  }'
```

### PUT /api/users/:id - Update user
```bash
# Replace USER_ID with actual MongoDB ObjectId
curl -X PUT http://localhost:5000/api/users/USER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane.doe@example.com"
  }'
```

### DELETE /api/users/:id - Delete user
```bash
# Replace USER_ID with actual MongoDB ObjectId
curl -X DELETE http://localhost:5000/api/users/USER_ID
```

---

## Transcription Endpoints

### POST /api/transcribe - Transcribe audio file
```bash
# Using multipart/form-data with file upload
curl -X POST http://localhost:5000/api/transcribe \
  -F "audio=@/path/to/audio/file.wav"

# Using raw audio data
curl -X POST http://localhost:5000/api/transcribe \
  -H "Content-Type: audio/wav" \
  --data-binary @/path/to/audio/file.wav
```

### POST /api/transcribe/live - Live transcription (WebSocket only)
```bash
# Note: This endpoint returns 426 error, use WebSocket instead
curl -X POST http://localhost:5000/api/transcribe/live
```

---

## Connection Endpoints (Requires Authentication)

**Note:** All connection endpoints require a Bearer token in the Authorization header.
First, you'll need to create a user and generate a JWT token, or use an existing token.

### GET /api/connections - List all connections
```bash
curl -X GET http://localhost:5000/api/connections \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# With query parameters
curl -X GET "http://localhost:5000/api/connections?status=active&limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### GET /api/connections/:id - Get connection by ID
```bash
curl -X GET http://localhost:5000/api/connections/CONNECTION_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### POST /api/connections/process - Process new interaction
```bash
curl -X POST http://localhost:5000/api/connections/process \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "audio": "base64_encoded_audio_data",
    "visual": {
      "screenshots": ["base64_image1", "base64_image2"],
      "embeddings": [0.1, 0.2, 0.3]
    },
    "context": {
      "timestamp": "2024-01-17T10:00:00Z",
      "location": "Conference Room A"
    }
  }'
```

### POST /api/connections/:id/add-interaction - Add interaction to existing connection
```bash
curl -X POST http://localhost:5000/api/connections/CONNECTION_ID/add-interaction \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "audio": "base64_encoded_audio_data",
    "visual": {
      "screenshots": ["base64_image1", "base64_image2"],
      "embeddings": [0.1, 0.2, 0.3]
    },
    "context": {
      "timestamp": "2024-01-17T10:00:00Z",
      "location": "Conference Room A"
    }
  }'
```

### POST /api/connections/confirm-match - Confirm a match
```bash
curl -X POST http://localhost:5000/api/connections/confirm-match \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "CONNECTION_ID",
    "audio": "base64_encoded_audio_data",
    "visual": {
      "screenshots": ["base64_image1", "base64_image2"],
      "embeddings": [0.1, 0.2, 0.3]
    },
    "context": {
      "timestamp": "2024-01-17T10:00:00Z",
      "location": "Conference Room A"
    }
  }'
```

### POST /api/connections/reject-match - Reject a match
```bash
curl -X POST http://localhost:5000/api/connections/reject-match \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "draft_profile_id": "DRAFT_PROFILE_ID"
  }'
```

### PATCH /api/connections/:id/approve - Approve a connection
```bash
curl -X PATCH http://localhost:5000/api/connections/CONNECTION_ID/approve \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": {
      "name": "Updated Name",
      "notes": "Additional notes"
    }
  }'
```

### DELETE /api/connections/:id - Delete a connection
```bash
curl -X DELETE http://localhost:5000/api/connections/CONNECTION_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Overshoot Endpoints

### POST /api/overshoot-result - Receive Overshoot SDK results
```bash
curl -X POST http://localhost:5000/api/overshoot-result \
  -H "Content-Type: application/json" \
  -d '{
    "result": "Some result text",
    "inference_latency_ms": 150,
    "total_latency_ms": 200
  }'
```

### POST /api/generate-headshot - Generate headshot using OpenRouter
```bash
curl -X POST http://localhost:5000/api/generate-headshot \
  -H "Content-Type: application/json" \
  -d '{
    "screenshots": [
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
    ]
  }'
```

---

## Authentication Notes

To get a JWT token for testing protected endpoints:

1. Create a user first (POST /api/users)
2. You'll need to generate a JWT token. The auth middleware expects:
   - Header: `Authorization: Bearer <token>`
   - Token payload should contain `userId` field
   - Token should be signed with `JWT_SECRET` (default: 'nexhacks-secret-key')

Example token generation (using Node.js):
```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: 'USER_ID_HERE' }, 'nexhacks-secret-key');
console.log(token);
```

Or use a tool like https://jwt.io to create test tokens.

---

## Example Test Sequence

1. **Check health:**
```bash
curl http://localhost:5000/health
```

2. **Create a user:**
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com"}'
```

3. **Get all users:**
```bash
curl http://localhost:5000/api/users
```

4. **Test overshoot result endpoint:**
```bash
curl -X POST http://localhost:5000/api/overshoot-result \
  -H "Content-Type: application/json" \
  -d '{"result": "test result", "inference_latency_ms": 100, "total_latency_ms": 150}'
```

