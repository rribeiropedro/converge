import Connection from '../models/Connection.js';
import { generateTextEmbedding } from './textEmbeddingService.js';
import mongoose from 'mongoose';

const MATCH_THRESHOLD = 0.75; // Cosine similarity threshold for text embeddings

/**
 * Find matching connection using text embedding of name + appearance
 * @param {string} userId - User ID to scope search
 * @param {string} name - Person's name (from transcript)
 * @param {string} appearanceDescription - Appearance description (from Overshoot)
 * @returns {Promise<Array>} - Array of matching connections with scores
 */
export async function findMatchingConnection(userId, name, appearanceDescription) {
  // Create searchable text from name + appearance
  const searchText = `${name || 'Unknown'} - ${appearanceDescription || ''}`.trim();

  if (!searchText || searchText === 'Unknown -') {
    console.warn('Insufficient data for appearance matching');
    return [];
  }

  try {
    // Generate embedding for the search text
    const queryEmbedding = await generateTextEmbedding(searchText);

    // Convert userId to ObjectId if string
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // MongoDB Atlas Vector Search
    const atlasMatches = await Connection.aggregate([
      {
        $vectorSearch: {
          index: "appearance_vector_index",
          path: "visual.appearance_embedding",
          queryVector: queryEmbedding,
          numCandidates: 50,
          limit: 3,
          filter: {
            user_id: userIdObj,
            status: { $in: ["draft", "approved"] }
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          company: 1,
          visual: 1,
          score: { "$meta": "vectorSearchScore" }
        }
      }
    ]).exec();

    return atlasMatches
      .filter(match => match.score >= MATCH_THRESHOLD)
      .map(match => ({
        connection: match,
        score: match.score
      }));

  } catch (e) {
    console.warn("Atlas Vector Search failed:", e.message);
    // No fallback for text embeddings - require Atlas Vector Search
    return [];
  }
}

/**
 * Add or update appearance embedding for a connection
 * @param {string} connectionId - Connection ID
 * @param {string} name - Person's name
 * @param {string} appearanceDescription - Appearance description
 * @param {object} context - Optional context (event name, etc)
 */
export async function addAppearanceEmbedding(connectionId, name, appearanceDescription, context = {}) {
  const searchText = `${name || 'Unknown'} - ${appearanceDescription || ''}`.trim();

  if (!searchText || searchText === 'Unknown -') {
    console.warn(`Cannot generate embedding - no name or appearance for connection ${connectionId}`);
    return;
  }

  const embedding = await generateTextEmbedding(searchText);

  const connection = await Connection.findById(connectionId);
  if (!connection) {
    throw new Error('Connection not found for updating appearance embedding');
  }

  // Add to history
  connection.visual.appearance_embedding_history.push({
    vector: embedding,
    captured_at: new Date(),
    event: context.event?.name,
    description_used: searchText
  });

  // Update primary embedding
  connection.visual.appearance_embedding = embedding;

  await connection.save();
  console.log(`✅ Added appearance embedding for connection ${connectionId}`);
}

/**
 * Determine match action based on results
 */
export function determineMatchAction(matches, draftProfileData) {
  if (matches.length === 0 || matches[0].score < MATCH_THRESHOLD) {
    return { action: 'create_new', draft: draftProfileData };
  }

  const bestMatch = matches[0];
  return { action: 'recognized', connection: bestMatch.connection, match_score: bestMatch.score };
}

export { MATCH_THRESHOLD };
