# Converge Backend

## Live transcription (WebSocket)

Socket.IO namespace: `/api/transcribe/live`

Client events:
- `start` (optional) payload fields: `model`, `language`, `diarize`, `smart_format`, `encoding`, `sample_rate`, `channels`
- `audio` binary audio chunks (Buffer/Uint8Array)
- `stop` to end the stream

Server events:
- `ready` when Deepgram is connected
- `transcript` payload: `{ transcript, words, speaker, is_final }`
- `speech_started`, `utterance_end`
- `error` for failures
- `closed` when the stream ends
A well-organized Express.js backend with Overshoot Vision SDK integration, OpenRouter/Gemini AI, and MongoDB support.

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── controllers/          # Business logic
│   │   ├── overshootController.js    # Overshoot & AI headshot generation
│   │   └── userController.js         # User management
│   ├── routes/               # API route definitions
│   │   ├── overshootRoutes.js        # Overshoot endpoints
│   │   ├── userRoutes.js             # User endpoints
│   │   └── index.js                  # Route aggregator
│   ├── models/               # Database models
│   │   └── User.js                   # User schema
│   ├── middleware/           # Custom middleware
│   │   └── errorHandler.js           # Error handling
│   ├── config/               # Configuration files
│   │   └── database.js               # MongoDB connection
│   └── index.js              # Main application entry
├── package.json
├── ENV_TEMPLATE.md           # Environment setup guide
├── MIGRATION_GUIDE.md        # Migration documentation
└── README.md                 # This file
```

## 🚀 Features

- **Overshoot Vision SDK Integration**: Receive and process real-time vision results
- **AI Headshot Generation**: Generate professional headshots using OpenRouter/Gemini 2.5 Flash Image
- **Organized Architecture**: Controllers, routes, models separated for scalability
- **MongoDB Support**: Optional database integration with Mongoose
- **CORS Enabled**: Configured for React client communication
- **Large Payload Support**: 50MB limit for base64 image uploads
- **Error Handling**: Centralized error handling middleware
- **ES6 Modules**: Modern JavaScript with import/export

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenRouter API key (for headshot generation)
- MongoDB (optional, for database features)

## 🔧 Installation

```bash
# Install dependencies
cd backend
npm install
```

## ⚙️ Configuration

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Client Configuration
CLIENT_URL=http://localhost:3000

# OpenRouter API Configuration (Required)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# MongoDB Configuration (Optional)
MONGODB_URI=mongodb://localhost:27017/converge
```

See `ENV_TEMPLATE.md` for detailed setup instructions.

## 🏃 Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:3001` (or your configured PORT)

## 📡 API Endpoints

### Health Check
```http
GET /health
GET /api/health
```
Returns server status.

### Overshoot Vision
```http
POST /api/overshoot-result
Content-Type: application/json

{
  "result": "...",
  "inference_latency_ms": 123,
  "total_latency_ms": 456
}
```
Receives and logs Overshoot SDK results.

### Headshot Generation
```http
POST /api/generate-headshot
Content-Type: application/json

{
  "screenshots": [
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,..."
  ]
}
```
Generates professional headshots using OpenRouter/Gemini.

**Response:**
```json
{
  "success": true,
  "image": "data:image/png;base64,...",
  "text": "..."
}
```

### User Routes
```http
GET /api/users
```
See `src/routes/userRoutes.js` for available user endpoints.

## 🔄 Client Integration

The backend is designed to work with the React client through proxy configuration:

**Client package.json:**
```json
{
  "proxy": "http://localhost:3001"
}
```

**Client fetch example:**
```javascript
const response = await fetch('/api/generate-headshot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ screenshots: [...] })
});
```

## 🗄️ Database

MongoDB integration is **optional** and commented out by default in `src/index.js`:

```javascript
// Uncomment to enable MongoDB
// connectDB();
```

To enable:
1. Set `MONGODB_URI` in `.env`
2. Uncomment `connectDB()` in `src/index.js`
3. Restart server

## 🛠️ Development

### Adding New Routes

1. **Create Controller** (`src/controllers/myController.js`):
```javascript
export const myFunction = async (req, res) => {
  // Your logic here
};
```

2. **Create Route** (`src/routes/myRoutes.js`):
```javascript
import express from 'express';
import { myFunction } from '../controllers/myController.js';

const router = express.Router();
router.post('/my-endpoint', myFunction);

export default router;
```

3. **Register Route** (`src/routes/index.js`):
```javascript
import myRoutes from './myRoutes.js';
router.use('/my-path', myRoutes);
```

### Project Conventions

- Use ES6 modules (`import`/`export`)
- Keep controllers focused on business logic
- Routes only handle HTTP routing
- Use async/await for asynchronous operations
- Add `.js` extensions to local imports
- Follow existing code style

## 🧪 Testing Endpoints

```bash
# Health check
curl http://localhost:3001/health

# API info
curl http://localhost:3001/api

# Overshoot result (test)
curl -X POST http://localhost:3001/api/overshoot-result \
  -H "Content-Type: application/json" \
  -d '{"result":"test","inference_latency_ms":100,"total_latency_ms":200}'
```

## 📊 Monitoring

The server logs:
- Startup confirmation with port and environment
- Overshoot results with timestamps and latency
- OpenRouter API interactions
- Error details in development mode

## 🔒 Security Considerations

- API keys stored in environment variables (never committed)
- CORS configured for specific client origin
- Request size limits (50MB) to prevent abuse
- Error messages sanitized in production
- Environment-based configuration

## 📚 Additional Documentation

- **`MIGRATION_GUIDE.md`**: How code was reorganized from converge-mobile
- **`ENV_TEMPLATE.md`**: Environment variable setup guide
- **Code Comments**: Inline documentation in all files

## 🤝 Integration with Converge Mobile

This backend serves the `converge-mobile/client` React application:

1. Client runs on port 3000
2. Backend runs on port 3001
3. Client uses proxy to forward `/api/*` requests
4. No CORS issues due to same-origin via proxy

## 🐛 Troubleshooting

### Server won't start
- Check if port 3001 is available
- Verify `.env` file exists and is valid
- Run `npm install` to ensure dependencies are installed

### MongoDB connection error
- Verify `MONGODB_URI` in `.env`
- Check if MongoDB is running
- Or comment out `connectDB()` if not using database

### OpenRouter API errors
- Verify `OPENROUTER_API_KEY` is set correctly
- Check API key has sufficient credits
- Review server logs for detailed error messages

### CORS errors
- Verify `CLIENT_URL` in `.env` matches your client URL
- Ensure client is using proxy configuration

## 📝 License

See main project license.

## 🙏 Credits

Built on top of:
- Express.js
- Overshoot Vision SDK
- OpenRouter API (Gemini 2.5 Flash Image)
- MongoDB/Mongoose

