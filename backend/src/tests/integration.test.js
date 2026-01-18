import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { mockParsedAudioData, mockParsedVisualData, mockContext } from './mockData.js';
import { processNewInteraction, approveConnection, getConnections, getConnectionById, deleteConnection, addInteractionToExistingConnection } from '../services/processingService.js';
import { calculateNeedsReview, getFieldsNeedingReview } from '../services/confidenceService.js';
import { calculateCosineSimilarity } from '../services/faceEmbeddingService.js';
import Connection from '../models/Connection.js';
import Interaction from '../models/Interaction.js';

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
  await Interaction.deleteMany({ user_id: TEST_USER_ID });
  console.log('Cleaned up test data.');
}

async function testConfidenceService() {
  console.log('\n=== Testing Confidence Service ===');
  
  const needsReview = calculateNeedsReview(mockParsedAudioData);
  console.log('Needs review (high confidence data):', needsReview);
  
  const fieldsNeedingReview = getFieldsNeedingReview(mockParsedAudioData);
  console.log('Fields needing review:', fieldsNeedingReview);
  
  const lowConfData = {
    profile: {
      name: { value: "John", confidence: "low" },
      company: { value: null, confidence: "low" },
      role: { value: null, confidence: "low" }
    }
  };
  
  const needsReviewLow = calculateNeedsReview(lowConfData);
  console.log('Needs review (low confidence data):', needsReviewLow);
  if (!needsReviewLow) throw new Error('Expected low confidence data to need review');
  
  console.log('Confidence Service tests passed.');
}

async function testCosineSimilarity() {
  console.log('\n=== Testing Cosine Similarity ===');
  
  const embedding1 = generate128DimEmbedding();
  const embedding2 = embedding1.map(val => val + (Math.random() * 0.05 - 0.025));
  
  const highSim = calculateCosineSimilarity(embedding1, embedding2);
  console.log('Similarity between similar embeddings:', highSim.toFixed(4));
  if (highSim < 0.9) throw new Error('Expected high similarity for similar embeddings');
  
  const embedding3 = generate128DimEmbedding();
  const lowSim = calculateCosineSimilarity(embedding1, embedding3);
  console.log('Similarity between random embeddings:', lowSim.toFixed(4));
  
  console.log('Cosine Similarity tests passed.');
}

async function testProcessNewConnection() {
  console.log('\n=== Testing Process New Connection ===');
  
  const uniqueEmbedding = generate128DimEmbedding();
  const visualWithEmbedding = { ...mockParsedVisualData, face_embedding: uniqueEmbedding };
  
  const result = await processNewInteraction(
    mockParsedAudioData,
    visualWithEmbedding,
    mockContext,
    TEST_USER_ID
  );
  
  if (result.type !== 'new') throw new Error('Expected type "new"');
  if (!result.draft) throw new Error('Expected a draft profile');
  console.log('New connection created. Draft ID:', result.draft._id);
  console.log('Status:', result.draft.status);
  
  return result.draft;
}

async function testApproveAndRecognize(draftConnection) {
  console.log('\n=== Testing Approve and Recognize Flow ===');
  
  const approved = await approveConnection(draftConnection._id);
  console.log('Approved connection. Status:', approved.status);
  if (approved.status !== 'approved') throw new Error('Expected status to be approved');
  
  const similarEmbedding = draftConnection.visual.face_embedding.map(val => val + (Math.random() * 0.02 - 0.01));
  const visualWithSimilarEmbedding = { ...mockParsedVisualData, face_embedding: similarEmbedding };
  
  const newAudioData = {
    ...mockParsedAudioData,
    topics_discussed: ['new topic 1', 'new topic 2'],
    transcript_summary: 'Follow-up conversation about new topics.'
  };
  
  const result = await processNewInteraction(
    newAudioData,
    visualWithSimilarEmbedding,
    { ...mockContext, event: { name: 'Follow-up Meeting', type: 'meetup' } },
    TEST_USER_ID
  );
  
  console.log('Process result type:', result.type);
  
  if (result.type === 'recognized') {
    console.log('Recognized existing connection!');
    console.log('Interaction count:', result.connection.interaction_count);
    console.log('Match score:', result.match_score);
  } else if (result.type === 'confirm_match') {
    console.log('Confirm match required. Score:', result.match_score);
    console.log('Possible match:', result.possible_match.name?.value);
  } else {
    console.log('Created new connection (embedding similarity too low for recognition).');
  }
  
  return result;
}

async function testGetConnections() {
  console.log('\n=== Testing Get Connections ===');
  
  const result = await getConnections(TEST_USER_ID);
  console.log('Total connections:', result.total);
  console.log('Connections returned:', result.connections.length);
  
  if (result.connections.length > 0) {
    console.log('First connection:', result.connections[0].name.value);
  }
  
  console.log('Get Connections test passed.');
}

async function testDeleteConnection(connectionId) {
  console.log('\n=== Testing Delete Connection ===');
  
  const result = await deleteConnection(connectionId);
  console.log('Deleted:', result.deleted);
  
  try {
    await getConnectionById(connectionId);
    throw new Error('Connection should have been deleted');
  } catch (e) {
    if (e.message === 'Connection not found') {
      console.log('Delete verification passed.');
    } else {
      throw e;
    }
  }
}

async function runAllTests() {
  try {
    await connectDB();
    await cleanup();
    
    await testConfidenceService();
    await testCosineSimilarity();
    
    const draftConnection = await testProcessNewConnection();
    const recognitionResult = await testApproveAndRecognize(draftConnection);
    
    await testGetConnections();
    
    await cleanup();
    
    console.log('\n=== All Tests Passed ===');
  } catch (error) {
    console.error('\nTest failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

runAllTests();
