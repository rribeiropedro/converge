import {
  processNewInteraction,
  approveConnection,
  getConnections,
  getConnectionById,
  deleteConnection,
  addInteractionToExistingConnection,
} from '../services/processingService.js';
import Connection from '../models/Connection.js';
import { generateFaceEmbedding } from '../services/faceEmbeddingService.js';
import { findMatchingConnection, determineMatchAction } from '../services/faceMatching.js';
import User from '../models/User.js';

export async function process(req, res) {
  try {
    const { audio, visual, context } = req.body;
    const userId = req.user._id;

    if (!audio) return res.status(400).json({ error: 'Audio data is required' });
    if (!visual) return res.status(400).json({ error: 'Visual data is required' });

    const result = await processNewInteraction(audio, visual, context || {}, userId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function addInteraction(req, res) {
  try {
    const { id: connectionId } = req.params;
    const { audio, visual, context } = req.body;

    if (!audio || !visual || !context) {
      return res.status(400).json({ error: 'Audio, visual, and context data are required' });
    }

    const updatedConnection = await addInteractionToExistingConnection(connectionId, audio, visual, context, req.user._id);

    res.status(200).json({
      type: 'recognized',
      connection: updatedConnection,
      interaction: updatedConnection.latestInteraction,
      message: `New interaction added to ${updatedConnection.name.value}`
    });
  } catch (error) {
    if (error.message === 'Connection not found') return res.status(404).json({ error: 'Connection not found' });
    console.error('Add interaction error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function confirmMatch(req, res) {
  try {
    const { connection_id, audio, visual, context } = req.body;

    if (!connection_id || !audio || !visual || !context) {
      return res.status(400).json({ error: 'Missing required data for confirming match.' });
    }

    const updatedConnection = await addInteractionToExistingConnection(connection_id, audio, visual, context, req.user._id);

    res.status(200).json({
      type: 'recognized',
      connection: updatedConnection,
      interaction: updatedConnection.latestInteraction,
      message: `Confirmed match and added interaction to ${updatedConnection.name.value}`
    });
  } catch (error) {
    console.error('Confirm match error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function rejectMatch(req, res) {
  try {
    const { draft_profile_id } = req.body;

    const connection = await getConnectionById(draft_profile_id);
    if (!connection) return res.status(404).json({ error: 'Draft profile not found.' });
    if (connection.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (connection.status !== 'temporary_draft') {
      return res.status(400).json({ error: 'Can only reject temporary draft profiles.' });
    }

    connection.status = 'draft';
    await connection.save();

    res.status(200).json({
      type: 'new',
      draft: connection,
      message: 'Rejected match, new draft profile created.'
    });
  } catch (error) {
    console.error('Reject match error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function list(req, res) {
  try {
    const userId = req.user._id;
    const { status, search, event, limit, offset } = req.query;

    const result = await getConnections(userId, {
      status,
      search,
      event,
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
    });

    res.json(result);
  } catch (error) {
    console.error('List connections error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params;
    const connection = await getConnectionById(id);

    if (connection.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(connection);
  } catch (error) {
    if (error.message === 'Connection not found') {
      return res.status(404).json({ error: 'Connection not found' });
    }
    console.error('Get connection error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function approve(req, res) {
  try {
    const { id } = req.params;
    const { updates } = req.body;

    const existingConnection = await getConnectionById(id);

    if (existingConnection.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const connection = await approveConnection(id, updates || {});

    res.json(connection);
  } catch (error) {
    if (error.message === 'Connection not found') {
      return res.status(404).json({ error: 'Connection not found' });
    }
    if (error.message === 'Only draft connections can be approved') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Approve connection error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function remove(req, res) {
  try {
    const { id } = req.params;

    const existingConnection = await getConnectionById(id);

    if (existingConnection.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await deleteConnection(id);

    res.json(result);
  } catch (error) {
    if (error.message === 'Connection not found') {
      return res.status(404).json({ error: 'Connection not found' });
    }
    console.error('Delete connection error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function testFaceRecognition(req, res) {
  try {
    const { imageData, userId } = req.body;

    if (!imageData) {
      return res.status(400).json({ 
        error: 'imageData is required (base64 data URI or URL)',
        example: 'data:image/jpeg;base64,/9j/4AAQ...'
      });
    }

    // Get or create test user if userId not provided
    let testUser;
    if (userId) {
      testUser = await User.findById(userId);
      if (!testUser) {
        return res.status(404).json({ error: 'User not found' });
      }
    } else {
      // Create or get test user
      testUser = await User.findOne({ email: 'test-face@nexhacks.com' });
      if (!testUser) {
        testUser = await User.create({
          name: 'Face Test User',
          email: 'test-face@nexhacks.com'
        });
      }
    }

    // Generate embedding
    console.log('Generating face embedding...');
    const embedding = await generateFaceEmbedding(imageData);
    
    if (!embedding || embedding.length !== 128) {
      return res.status(500).json({ 
        error: 'Invalid embedding generated',
        embedding_length: embedding?.length 
      });
    }

    // Find matches
    console.log('Finding matching connections...');
    const matches = await findMatchingConnection(testUser._id, embedding);

    // Determine action
    const action = determineMatchAction(matches, {
      name: { value: 'Test Person', confidence: 'high', source: 'manual' }
    });

    res.json({
      success: true,
      embedding_length: embedding.length,
      embedding_preview: embedding.slice(0, 5),
      matches: matches.map(m => ({
        connection_id: m.connection._id,
        name: m.connection.name.value,
        company: m.connection.company?.value,
        score: m.score,
        confidence: m.score >= 0.85 ? 'high' : m.score >= 0.70 ? 'medium' : 'low'
      })),
      match_action: action.action,
      match_score: action.match_score,
      message: `Found ${matches.length} potential match${matches.length !== 1 ? 'es' : ''}`
    });
  } catch (error) {
    console.error('Face recognition test error:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
