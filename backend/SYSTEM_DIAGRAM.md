# Complete System Diagram

## 🏗️ Full Stack Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                            │
│                         http://localhost:3000                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              React App (converge-mobile/client)            │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │                                                             │   │
│  │  • Camera Feed                                              │   │
│  │  • @overshoot/sdk (Real-time Vision)                       │   │
│  │  • Screenshot Capture                                       │   │
│  │  • Headshot Display                                         │   │
│  │                                                             │   │
│  │  Proxy: "http://localhost:3001"                            │   │
│  │         ↓                                                   │   │
│  └─────────┼───────────────────────────────────────────────────┘   │
│            │                                                         │
└────────────┼─────────────────────────────────────────────────────────┘
             │
             │ HTTP Requests
             │ • POST /api/generate-headshot
             │ • POST /api/overshoot-result
             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      EXPRESS BACKEND SERVER                         │
│                       http://localhost:3001                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                     backend/src/index.js                   │   │
│  │  • CORS Configuration                                       │   │
│  │  • 50MB Payload Limit                                       │   │
│  │  • Routes Mounting                                          │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                  backend/src/routes/                       │   │
│  │  ┌──────────────────────────────────────────────────┐     │   │
│  │  │              index.js (aggregator)               │     │   │
│  │  │  • Mounts all route modules                      │     │   │
│  │  │  • API info endpoint                             │     │   │
│  │  └────────────┬─────────────────────┬────────────────┘     │   │
│  │               │                     │                       │   │
│  │               ↓                     ↓                       │   │
│  │  ┌─────────────────────┐  ┌──────────────────────┐        │   │
│  │  │  overshootRoutes.js │  │   userRoutes.js      │        │   │
│  │  │  • /overshoot-result│  │   • /users           │        │   │
│  │  │  • /generate-headshot│  └──────────────────────┘        │   │
│  │  └──────────┬───────────┘                                  │   │
│  └─────────────┼──────────────────────────────────────────────┘   │
│                ↓                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                backend/src/controllers/                    │   │
│  │  ┌──────────────────────────────────────────────────┐     │   │
│  │  │         overshootController.js                   │     │   │
│  │  │                                                  │     │   │
│  │  │  receiveOvershootResult()                        │     │   │
│  │  │    • Logs to terminal                            │     │   │
│  │  │    • Returns confirmation                        │     │   │
│  │  │                                                  │     │   │
│  │  │  generateHeadshot()                              │     │   │
│  │  │    • Validates 2 screenshots                     │     │   │
│  │  │    • Prepares OpenRouter request                 │     │   │
│  │  │    • Handles multiple response formats           │     │   │
│  │  └────────────────────────┬─────────────────────────┘     │   │
│  └───────────────────────────┼───────────────────────────────┘   │
│                              │                                     │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               │ HTTPS Request
                               │ POST https://openrouter.ai/api/v1/chat/completions
                               │ Authorization: Bearer <OPENROUTER_API_KEY>
                               │ Body: { model, messages: [...images, prompt] }
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                          OPENROUTER API                             │
│                      https://openrouter.ai                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                 Routes to: Google Gemini 2.5 Flash Image            │
│                                                                      │
│  Input:                                                              │
│    • 2 base64-encoded images                                        │
│    • Professional headshot prompt                                   │
│                                                                      │
│  Processing:                                                         │
│    • Analyzes reference photos                                      │
│    • Generates professional headshot                                │
│    • Returns base64-encoded image                                   │
│                                                                      │
│  Output:                                                             │
│    { choices: [{ message: { images: [...] } }] }                   │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               │ Response
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND PROCESSES RESPONSE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  • Extracts image from multiple possible formats                    │
│  • Handles fallback scenarios                                       │
│  • Logs response structure                                          │
│  • Returns: { success: true, image: "base64...", text: "..." }    │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               │ JSON Response
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT RECEIVES IMAGE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  • Displays generated headshot                                      │
│  • Shows download button                                            │
│  • Updates UI state                                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Request Flow: Generate Headshot

```
1. USER INTERACTION
   └─ Camera detects face (via @overshoot/sdk)
   └─ App captures 2 screenshots

2. CLIENT REQUEST
   fetch('/api/generate-headshot', {
     method: 'POST',
     body: JSON.stringify({
       screenshots: [
         "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
         "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
       ]
     })
   })
   
3. PROXY FORWARDS
   http://localhost:3000/api/generate-headshot
   ↓
   http://localhost:3001/api/generate-headshot

4. BACKEND ROUTING
   index.js → routes/index.js → routes/overshootRoutes.js
   
5. CONTROLLER PROCESSING
   controllers/overshootController.generateHeadshot()
   • Validates input (exactly 2 screenshots)
   • Extracts base64 data
   • Prepares prompt
   • Creates OpenRouter request
   
6. OPENROUTER API CALL
   POST https://openrouter.ai/api/v1/chat/completions
   Headers:
     - Content-Type: application/json
     - Authorization: Bearer <API_KEY>
   Body:
     {
       model: "google/gemini-2.5-flash-image",
       messages: [{
         role: "user",
         content: [
           { type: "image_url", image_url: { url: "..." } },
           { type: "image_url", image_url: { url: "..." } },
           { type: "text", text: "Professional headshot prompt..." }
         ]
       }]
     }
   
7. GEMINI PROCESSES
   • Analyzes 2 reference photos
   • Generates professional headshot
   • Returns base64 image
   
8. BACKEND RESPONSE HANDLING
   • Extracts image from response
   • Handles multiple format possibilities
   • Logs debug information
   • Returns to client
   
9. CLIENT DISPLAYS
   • Shows generated image in UI
   • Enables download button
   • Stops camera
```

---

## 🔄 Request Flow: Overshoot Result Logging

```
1. OVERSHOOT SDK GENERATES RESULT
   {
     result: {
       face_detected: true,
       appearance_profile: "...",
       environment_context: "..."
     },
     inference_latency_ms: 123,
     total_latency_ms: 456
   }

2. CLIENT LOGS TO BACKEND
   fetch('/api/overshoot-result', {
     method: 'POST',
     body: JSON.stringify(result)
   })
   
3. BACKEND ROUTING
   index.js → routes/index.js → routes/overshootRoutes.js
   
4. CONTROLLER PROCESSING
   controllers/overshootController.receiveOvershootResult()
   • Logs to terminal with timestamp
   • Returns confirmation
   
5. TERMINAL OUTPUT
   === Overshoot Result ===
   [12:34:56] Result text: {"face_detected":true,...}
   [12:34:56] Inference latency: 123 ms
   [12:34:56] Total latency: 456 ms
   ========================
   
6. CLIENT CONTINUES
   • Displays result in UI
   • Continues processing
```

---

## 🗂️ File Structure with Responsibilities

```
backend/
│
├── src/
│   │
│   ├── index.js                           [ENTRY POINT]
│   │   • Initialize Express app
│   │   • Configure middleware (CORS, JSON parsing, body parsing)
│   │   • Mount route modules
│   │   • Error handling
│   │   • Start server on port 3001
│   │
│   ├── routes/
│   │   │
│   │   ├── index.js                       [ROUTE AGGREGATOR]
│   │   │   • Collect all route modules
│   │   │   • Mount under appropriate paths
│   │   │   • Provide API info endpoint
│   │   │
│   │   ├── overshootRoutes.js             [OVERSHOOT ROUTES]
│   │   │   POST /overshoot-result         → receiveOvershootResult
│   │   │   POST /generate-headshot        → generateHeadshot
│   │   │
│   │   └── userRoutes.js                  [USER ROUTES]
│   │       GET /users                     → userController
│   │
│   ├── controllers/
│   │   │
│   │   ├── overshootController.js         [OVERSHOOT LOGIC]
│   │   │   │
│   │   │   ├── receiveOvershootResult()
│   │   │   │   • Extract result data
│   │   │   │   • Log to terminal
│   │   │   │   • Return confirmation
│   │   │   │
│   │   │   └── generateHeadshot()
│   │   │       • Validate screenshots (exactly 2)
│   │   │       • Prepare image content
│   │   │       • Build OpenRouter request
│   │   │       • Call OpenRouter API
│   │   │       • Parse response (multiple formats)
│   │   │       • Return image + metadata
│   │   │
│   │   └── userController.js              [USER LOGIC]
│   │       • User CRUD operations
│   │
│   ├── models/
│   │   └── User.js                        [DATABASE MODELS]
│   │       • Mongoose schema for users
│   │
│   ├── middleware/
│   │   └── errorHandler.js                [ERROR HANDLING]
│   │       • Centralized error processing
│   │
│   └── config/
│       └── database.js                    [DATABASE CONFIG]
│           • MongoDB connection
│           • Connection error handling
│
├── package.json                           [DEPENDENCIES]
│   • Express, CORS, dotenv, mongoose
│   • ES6 module type
│   • Start/dev scripts
│
├── .env (not committed)                   [SECRETS]
│   • PORT=3001
│   • OPENROUTER_API_KEY=...
│   • CLIENT_URL=http://localhost:3000
│   • MONGODB_URI=...
│
└── Documentation/
    ├── README.md                          [MAIN DOCS]
    ├── QUICK_START.md                     [5-MIN SETUP]
    ├── MIGRATION_GUIDE.md                 [MIGRATION INFO]
    ├── ARCHITECTURE_COMPARISON.md         [BEFORE/AFTER]
    ├── ENV_TEMPLATE.md                    [ENV SETUP]
    ├── ANALYSIS_SUMMARY.md                [OVERVIEW]
    └── SYSTEM_DIAGRAM.md                  [THIS FILE]
```

---

## 🔌 API Endpoint Map

```
http://localhost:3001
│
├── /health                                [GET]
│   └─ Health check (no /api prefix)
│
└── /api                                   [MAIN API]
    │
    ├── /                                  [GET]
    │   └─ API info & endpoint list
    │
    ├── /health                            [GET]
    │   └─ API health check
    │
    ├── /overshoot-result                  [POST]
    │   └─ Log Overshoot SDK results
    │       Input:  { result, inference_latency_ms, total_latency_ms }
    │       Output: { status: 'received' }
    │
    ├── /generate-headshot                 [POST]
    │   └─ Generate AI headshot
    │       Input:  { screenshots: ["base64...", "base64..."] }
    │       Output: { success: true, image: "base64...", text: "..." }
    │
    └── /users                             [GET]
        └─ User management (future endpoints here)
```

---

## 🌐 Technology Stack

```
┌─────────────────────────────────────────────┐
│              FRONTEND (CLIENT)              │
├─────────────────────────────────────────────┤
│  • React 18.2.0                             │
│  • @overshoot/sdk 0.1.0-alpha.2            │
│  • react-scripts 5.0.1                      │
│  • Port: 3000                               │
└─────────────────────────────────────────────┘
                    ↕ HTTP
┌─────────────────────────────────────────────┐
│              BACKEND (API)                  │
├─────────────────────────────────────────────┤
│  • Node.js + Express 4.21.0                 │
│  • ES6 Modules                              │
│  • CORS 2.8.5                               │
│  • dotenv 16.4.5                            │
│  • Port: 3001                               │
└─────────────────────────────────────────────┘
                    ↕ HTTPS
┌─────────────────────────────────────────────┐
│           EXTERNAL SERVICES                 │
├─────────────────────────────────────────────┤
│  • OpenRouter API                           │
│    └─ Google Gemini 2.5 Flash Image         │
│  • Overshoot Vision API                     │
└─────────────────────────────────────────────┘
                    ↕ Optional
┌─────────────────────────────────────────────┐
│              DATABASE                       │
├─────────────────────────────────────────────┤
│  • MongoDB (optional)                       │
│  • Mongoose 8.5.0                           │
└─────────────────────────────────────────────┘
```

---

## 📈 Data Flow Summary

| Step | Component | Action | Data Format |
|------|-----------|--------|-------------|
| 1 | User | Opens browser | - |
| 2 | React Client | Starts camera | Video stream |
| 3 | Overshoot SDK | Analyzes frames | JSON results |
| 4 | React Client | Captures screenshots | Base64 JPEG |
| 5 | React Client | Sends to backend | HTTP POST JSON |
| 6 | Express Backend | Routes request | Express routing |
| 7 | Controller | Validates & prepares | OpenRouter format |
| 8 | Backend | Calls OpenRouter | HTTPS POST |
| 9 | Gemini AI | Generates headshot | Base64 PNG |
| 10 | Backend | Extracts image | JSON response |
| 11 | React Client | Displays image | <img> element |
| 12 | User | Downloads image | PNG file |

---

## 🎯 Summary

This system provides:

- ✅ **Real-time vision** via Overshoot SDK
- ✅ **AI headshot generation** via Gemini
- ✅ **Organized backend** for scalability
- ✅ **Comprehensive docs** for maintenance
- ✅ **100% API compatibility** with original

The architecture is **production-ready** and follows **industry best practices**! 🚀

