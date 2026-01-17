# Overshoot Vision Starter

A minimal starter application using the Overshoot SDK with React.js frontend and Express.js backend.

## Overview

This project demonstrates how to integrate the Overshoot RealtimeVision SDK for real-time video analysis. The SDK can analyze video from your device camera or video files.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- An Overshoot API key (get one at [Overshoot Platform](https://overshoot.ai))

## Project Structure

```
converge/
├── client/          # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.jsx
│   ├── public/
│   └── package.json
├── server/          # Express backend
│   ├── index.js
│   └── package.json
└── docs/            # Documentation
```

## Setup Instructions

### 1. Install Dependencies

#### Frontend (React)
```bash
cd client
npm install
```

#### Backend (Express)
```bash
cd server
npm install
```

### 2. Configure API Key

1. Copy the example environment file:
```bash
cd client
cp .env.example .env
```

2. Edit `client/.env` and add your Overshoot API key:
```
REACT_APP_OVERSHOOT_API_KEY=your-actual-api-key-here
```

### 3. Run the Application

#### Development Mode

**Terminal 1 - Start the React app:**
```bash
cd client
npm start
```
The React app will run on http://localhost:3000

**Terminal 2 - Start the Express server:**
```bash
cd server
npm run dev
```
The server will run on http://localhost:3001

#### Production Mode

1. Build the React app:
```bash
cd client
npm run build
```

2. Start the Express server (it will serve the React build):
```bash
cd server
NODE_ENV=production npm start
```

## Features

- **Camera Access**: Uses device camera for real-time video analysis
- **Real-time Results**: Displays AI analysis results as they arrive
- **Dynamic Prompts**: Update the analysis prompt without restarting
- **Performance Metrics**: Shows inference and total latency

## Usage

1. Click "Start Camera" to begin video analysis
2. The app will request camera permissions (first time only)
3. Results will appear in real-time as the AI analyzes video frames
4. You can update the prompt by typing in the input field and pressing Enter
5. Click "Stop Camera" to stop the analysis

## Configuration

You can customize the Overshoot SDK configuration in `client/src/App.jsx`:

- **apiUrl**: API endpoint (default: `https://cluster1.overshoot.ai/api/v0.2`)
- **prompt**: Initial analysis prompt
- **source**: Video source (`camera` or `video` file)
- **processing**: Frame processing parameters (fps, sampling ratio, etc.)
- **model**: Vision model to use

See the [Overshoot Documentation](docs/OvershootDocs.pdf) for more configuration options.

## API Endpoints

- `GET /api/health` - Health check endpoint

## Troubleshooting

- **Camera not working**: Ensure you've granted camera permissions in your browser
- **API errors**: Verify your API key is correct in the `.env` file
- **No results**: Check browser console for errors

## Resources

- [Overshoot Platform](https://overshoot.ai)
- [Overshoot SDK Documentation](docs/OvershootDocs.pdf)

