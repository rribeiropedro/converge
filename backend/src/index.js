import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import connectDB from './config/database.js';
import apiRoutes from './routes/index.js';
import transcribeRoutes from './routes/transcribeRoutes.js';
import { registerTranscribeLiveSocket } from './realtime/transcribeSocket.js';
import { registerSessionSocket } from './realtime/sessionSocket.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Connect to MongoDB (required for session finalization)
connectDB();

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const io = new Server(server, { cors: corsOptions });
registerTranscribeLiveSocket(io);
registerSessionSocket(io);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to NexHacks API',
    version: '1.0.0',
    endpoints: {
      api: '/api',
      users: '/api/users',
      transcribe: '/api/transcribe',
      connections: '/api/connections',
      overshoot: '/api/overshoot-result',
      headshot: '/api/generate-headshot',
      health: '/health'
    }
  });
});

// API Routes
app.use('/api', apiRoutes);
app.use('/api/transcribe', transcribeRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Converge server is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Converge server is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

