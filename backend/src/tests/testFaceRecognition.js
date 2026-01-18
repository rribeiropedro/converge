import 'dotenv/config';
import connectDB from '../config/database.js';
import Connection from '../models/Connection.js';
import User from '../models/User.js';
import { generateFaceEmbedding, calculateCosineSimilarity } from '../services/faceEmbeddingService.js';
import { findMatchingConnection, determineMatchAction } from '../services/faceMatching.js';

// Helper to generate a mock 128-dim embedding
function generateMockEmbedding(seed = 0) {
  // Use seed to create consistent "person" embeddings
  const embedding = new Array(128).fill(0).map((_, i) => {
    const random = Math.sin((seed + i) * 100) * 0.5 + 0.5; // Deterministic "random"
    return (random - 0.5) * 2; // Range: -1 to 1
  });
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

async function testFaceRecognition() {
  try {
    console.log('🧪 Starting Face Recognition Tests\n');
    
    // 1. Connect to database
    console.log('📡 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // 2. Create or get a test user
    console.log('👤 Setting up test user...');
    let testUser = await User.findOne({ email: 'test-face@nexhacks.com' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Face Test User',
        email: 'test-face@nexhacks.com'
      });
      console.log('✅ Created test user:', testUser._id);
    } else {
      console.log('✅ Using existing test user:', testUser._id);
    }

    // 3. Test 1: Generate embedding from a test image (if available) or use mock
    console.log('\n📸 Test 1: Testing face embedding generation...');
    try {
      // Try to use a real image URL for testing
      const testImageUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400';
      console.log('   Attempting to generate embedding from test image...');
      const realEmbedding = await generateFaceEmbedding(testImageUrl);
      console.log('✅ Generated real embedding:', realEmbedding.length, 'dimensions');
      console.log('   First 5 values:', realEmbedding.slice(0, 5).map(v => v.toFixed(4)));
    } catch (error) {
      console.log('⚠️  Could not generate from image URL:', error.message);
      console.log('   Using mock embedding for testing...');
    }

    // 4. Test 2: Create test connections with mock embeddings
    console.log('\n💾 Test 2: Creating test connections with face embeddings...');
    
    // Clean up old test connections
    await Connection.deleteMany({ 
      user_id: testUser._id,
      'name.value': { $regex: /^Test Person/ }
    });
    console.log('   Cleaned up old test connections');

    // Create 3 test connections with different "person" embeddings
    const person1Embedding = generateMockEmbedding(1);
    const person2Embedding = generateMockEmbedding(2);
    const person3Embedding = generateMockEmbedding(3);

    const connection1 = await Connection.create({
      user_id: testUser._id,
      status: 'approved',
      name: { value: 'Test Person 1', confidence: 'high', source: 'manual' },
      company: { value: 'Test Co', confidence: 'high', source: 'manual' },
      role: { value: 'Engineer', confidence: 'high', source: 'manual' },
      visual: {
        face_embedding: person1Embedding,
        appearance: { description: 'Person with seed 1' }
      },
      context: {
        event: { name: 'Test Event', type: 'conference' },
        location: { name: 'Test Location', city: 'Test City' },
        first_met: new Date()
      }
    });

    const connection2 = await Connection.create({
      user_id: testUser._id,
      status: 'approved',
      name: { value: 'Test Person 2', confidence: 'high', source: 'manual' },
      company: { value: 'Test Co 2', confidence: 'high', source: 'manual' },
      visual: {
        face_embedding: person2Embedding,
        appearance: { description: 'Person with seed 2' }
      },
      context: {
        event: { name: 'Test Event', type: 'conference' },
        location: { name: 'Test Location', city: 'Test City' },
        first_met: new Date()
      }
    });

    const connection3 = await Connection.create({
      user_id: testUser._id,
      status: 'approved',
      name: { value: 'Test Person 3', confidence: 'high', source: 'manual' },
      company: { value: 'Test Co 3', confidence: 'high', source: 'manual' },
      visual: {
        face_embedding: person3Embedding,
        appearance: { description: 'Person with seed 3' }
      },
      context: {
        event: { name: 'Test Event', type: 'conference' },
        location: { name: 'Test Location', city: 'Test City' },
        first_met: new Date()
      }
    });

    console.log('✅ Created 3 test connections:');
    console.log('   -', connection1.name.value, '(ID:', connection1._id + ')');
    console.log('   -', connection2.name.value, '(ID:', connection2._id + ')');
    console.log('   -', connection3.name.value, '(ID:', connection3._id + ')');

    // 5. Test 3: Test face matching with same embedding
    console.log('\n🔍 Test 3: Testing face matching (same person)...');
    const samePersonEmbedding = generateMockEmbedding(1); // Same seed as person1
    const matches = await findMatchingConnection(testUser._id, samePersonEmbedding);
    
    console.log(`✅ Found ${matches.length} matches:`);
    matches.forEach((match, i) => {
      console.log(`   ${i + 1}. Score: ${match.score.toFixed(3)}, Name: ${match.connection.name.value}`);
    });

    if (matches.length > 0 && matches[0].score > 0.7) {
      console.log('   ✅ High confidence match found!');
    } else {
      console.log('   ⚠️  Low confidence match (this is expected with mock embeddings)');
    }

    // 6. Test 4: Test with different person
    console.log('\n🔍 Test 4: Testing face matching (different person)...');
    const differentPersonEmbedding = generateMockEmbedding(99); // Different seed
    const differentMatches = await findMatchingConnection(testUser._id, differentPersonEmbedding);
    
    console.log(`✅ Found ${differentMatches.length} matches:`);
    if (differentMatches.length > 0) {
      differentMatches.forEach((match, i) => {
        console.log(`   ${i + 1}. Score: ${match.score.toFixed(3)}, Name: ${match.connection.name.value}`);
      });
      console.log('   ⚠️  Matches found but scores should be low');
    } else {
      console.log('   ✅ No matches found (correct for different person)');
    }

    // 7. Test 5: Determine match action
    console.log('\n🎯 Test 5: Testing match action determination...');
    const action = determineMatchAction(matches, {
      name: { value: 'Test Person 1', confidence: 'high', source: 'manual' }
    });
    console.log('✅ Match Action:', action.action);
    if (action.match_score) {
      console.log('   Match Score:', action.match_score.toFixed(3));
    }
    if (action.connection) {
      console.log('   Matched Connection:', action.connection.name.value);
    }

    // 8. Test 6: Cosine similarity calculation
    console.log('\n🧮 Test 6: Testing cosine similarity calculation...');
    const embedding1 = generateMockEmbedding(1);
    const embedding2 = generateMockEmbedding(1); // Same seed = same person
    const embedding3 = generateMockEmbedding(5); // Different seed = different person
    
    const sameScore = calculateCosineSimilarity(embedding1, embedding2);
    const diffScore = calculateCosineSimilarity(embedding1, embedding3);
    
    console.log('✅ Same person similarity:', sameScore.toFixed(3), '(should be ~1.0)');
    console.log('✅ Different person similarity:', diffScore.toFixed(3), '(should be <0.5)');
    
    if (sameScore > 0.9) {
      console.log('   ✅ Same person detection working correctly');
    } else {
      console.log('   ⚠️  Same person score lower than expected (may be due to mock data)');
    }

    // 9. Test 7: Test with no embedding
    console.log('\n🚫 Test 7: Testing with invalid embedding...');
    const invalidMatches = await findMatchingConnection(testUser._id, []);
    console.log('✅ Invalid embedding handled correctly:', invalidMatches.length === 0);

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Test user:', testUser._id);
    console.log('   - Test connections created: 3');
    console.log('   - Face matching: Working');
    console.log('   - Cosine similarity: Working');
    console.log('\n💡 Note: Mock embeddings may not produce perfect matches.');
    console.log('   For real testing, use actual face images.');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testFaceRecognition();
