import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SessionManager from '../realtime/SessionManager.js';
import Connection from '../models/Connection.js';
import { createDraftConnection } from '../services/processingService.js';

dotenv.config();

const TEST_USER_ID = new mongoose.Types.ObjectId();

function generate128DimEmbedding() {
  return new Array(128).fill(0).map(() => Math.random() * 2 - 1);
}

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexhacks_test';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
}

async function cleanup() {
  await Connection.deleteMany({ user_id: TEST_USER_ID });
  console.log('Cleaned up test data.');
}

async function testSessionCreate() {
  console.log('\n=== Testing Session Creation ===');
  
  const sessionId = `test-session-${Date.now()}`;
  const context = {
    event: { name: 'Test Event', type: 'hackathon' },
    location: { name: 'Test Location', city: 'Test City' }
  };

  const session = SessionManager.createSession(sessionId, TEST_USER_ID.toString(), context);
  
  if (!session) throw new Error('Session not created');
  if (session.userId !== TEST_USER_ID.toString()) throw new Error('User ID mismatch');
  if (!session.visual || !session.audio) throw new Error('Session structure invalid');
  if (session.visual.face_embedding.length !== 0) throw new Error('Visual should be empty initially');
  if (session.audio.transcript_chunks.length !== 0) throw new Error('Audio should be empty initially');
  
  console.log(`Session created: ${sessionId}`);
  console.log('Initial state verified ✓');
  
  return sessionId;
}

async function testVisualAccumulation(sessionId) {
  console.log('\n=== Testing Visual Accumulation ===');
  
  const visualData = {
    face_embedding: generate128DimEmbedding(),
    appearance: {
      description: 'Blue blazer, short dark hair, glasses',
      distinctive_features: ['glasses', 'red lanyard']
    },
    environment: {
      description: 'By the coffee station near main stage',
      landmarks: ['coffee station', 'Stripe booth']
    }
  };

  const beforeUpdate = new Date();
  SessionManager.updateVisual(sessionId, visualData);
  const session = SessionManager.getSession(sessionId);
  
  if (session.visual.face_embedding.length !== 128) throw new Error('Face embedding not set');
  if (session.visual.appearance.description !== visualData.appearance.description) {
    throw new Error('Appearance not updated');
  }
  if (session.visual.environment.description !== visualData.environment.description) {
    throw new Error('Environment not updated');
  }
  if (session.lastActivity < beforeUpdate) throw new Error('lastActivity not updated');
  
  console.log('Visual data merged ✓');
  console.log('lastActivity updated ✓');
}

async function testAudioAccumulation(sessionId) {
  console.log('\n=== Testing Audio Accumulation ===');
  
  // Add multiple transcript chunks
  const chunks = [
    { transcript: 'Hi, my name is Sarah Chen.', is_final: false, speaker: 0 },
    { transcript: 'I work at Stripe.', is_final: false, speaker: 0 },
    { transcript: 'We are working on climate tech initiatives.', is_final: true, speaker: 0 }
  ];

  chunks.forEach(chunk => {
    SessionManager.updateAudio(sessionId, chunk);
  });

  // Add profile data
  SessionManager.updateAudio(sessionId, {
    profile: {
      name: { value: 'Sarah Chen', confidence: 'high' },
      company: { value: 'Stripe', confidence: 'high' },
      role: { value: 'PM', confidence: 'medium' }
    },
    topics_discussed: ['climate tech', 'hiring'],
    their_challenges: ['Need UX designer'],
    follow_up_hooks: [{ type: 'resource_share', detail: 'Send McKinsey report' }],
    personal_details: ['Has a dog named Pixel']
  });

  const session = SessionManager.getSession(sessionId);
  
  if (session.audio.transcript_chunks.length !== 3) {
    throw new Error(`Expected 3 transcript chunks, got ${session.audio.transcript_chunks.length}`);
  }
  if (session.audio.profile.name.value !== 'Sarah Chen') {
    throw new Error('Profile name not set');
  }
  if (session.audio.topics_discussed.length !== 2) {
    throw new Error('Topics not accumulated');
  }
  if (session.audio.follow_up_hooks.length !== 1) {
    throw new Error('Follow-up hooks not accumulated');
  }
  
  console.log('Transcript chunks accumulated:', session.audio.transcript_chunks.length, '✓');
  console.log('Topics merged ✓');
  console.log('Profile data merged ✓');
}

async function testFinalization(sessionId) {
  console.log('\n=== Testing Finalization ===');
  
  // Ensure we have both visual and audio data
  const session = SessionManager.getSession(sessionId);
  if (!session.visual.face_embedding.length) {
    // Add visual data if missing
    SessionManager.updateVisual(sessionId, {
      face_embedding: generate128DimEmbedding()
    });
  }

  // Finalize session
  const snapshot = SessionManager.finalizeSession(sessionId);
  
  if (!snapshot) throw new Error('Snapshot not returned');
  if (snapshot.userId !== TEST_USER_ID.toString()) throw new Error('Snapshot userId mismatch');
  if (!snapshot.visual || !snapshot.audio) throw new Error('Snapshot structure invalid');
  if (!snapshot.endTime) throw new Error('endTime not set');
  if (!snapshot.duration) throw new Error('duration not set');
  
  // Verify session is purged from memory
  try {
    SessionManager.getSession(sessionId);
    throw new Error('Session should be purged from memory');
  } catch (error) {
    if (error.message.includes('not found')) {
      console.log('Session purged from memory ✓');
    } else {
      throw error;
    }
  }

  // Create draft connection in MongoDB
  const audioData = {
    profile: snapshot.audio.profile,
    topics_discussed: snapshot.audio.topics_discussed,
    their_challenges: snapshot.audio.their_challenges,
    follow_up_hooks: snapshot.audio.follow_up_hooks,
    personal_details: snapshot.audio.personal_details,
    transcript_summary: snapshot.audio.transcript_summary || 'Test conversation'
  };

  const draftConnection = await createDraftConnection(
    audioData,
    snapshot.visual,
    snapshot.context,
    snapshot.userId,
    false
  );

  if (!draftConnection._id) throw new Error('Connection not created in MongoDB');
  if (draftConnection.status !== 'draft') throw new Error('Connection status should be draft');
  if (draftConnection.name.value !== 'Sarah Chen') {
    throw new Error(`Expected name 'Sarah Chen', got '${draftConnection.name.value}'`);
  }
  
  console.log('Connection saved to MongoDB:', draftConnection._id, '✓');
  
  return draftConnection._id.toString();
}

async function testStaleCleanup() {
  console.log('\n=== Testing Stale Cleanup ===');
  
  const sessionId = `stale-session-${Date.now()}`;
  SessionManager.createSession(sessionId, TEST_USER_ID.toString(), {
    event: { name: 'Test', type: 'other' },
    location: { name: 'Test', city: 'Test' }
  });

  // Manually set lastActivity to 11 minutes ago
  const session = SessionManager.getSession(sessionId);
  session.lastActivity = new Date(Date.now() - 11 * 60 * 1000);

  // Check for stale sessions
  const staleIds = SessionManager.checkStaleSessions();
  
  if (!staleIds.includes(sessionId)) {
    throw new Error('Stale session not detected');
  }
  
  console.log('Stale session detected ✓');
  
  // Clean up the stale session manually for test
  SessionManager.finalizeSession(sessionId);
  console.log('Stale session cleanup verified ✓');
}

async function runAllTests() {
  try {
    await connectDB();
    await cleanup();
    
    const sessionId = await testSessionCreate();
    await testVisualAccumulation(sessionId);
    await testAudioAccumulation(sessionId);
    const connectionId = await testFinalization(sessionId);
    
    await testStaleCleanup();
    
    // Clean up test connection
    await Connection.findByIdAndDelete(connectionId);
    await cleanup();
    
    console.log('\n=== All Tests Passed ===');
  } catch (error) {
    console.error('\nTest failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

runAllTests();

