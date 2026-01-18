import Connection from '../models/Connection.js';
import { calculateCosineSimilarity } from './faceEmbeddingService.js';
import mongoose from 'mongoose';

const MATCH_THRESHOLD = 0.80; // 80% - if score >= 0.80, update existing; if < 0.80, create new

export async function findMatchingConnection(userId, faceEmbedding) {
  if (!faceEmbedding || faceEmbedding.length !== 128) {
    console.warn('Invalid face embedding provided for matching.');
    return [];
  }

  try {
    // $vectorSearch MUST be the first stage in the pipeline
    // Convert userId to ObjectId if it's a string
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    
    const atlasMatches = await Connection.aggregate([
      {
        $vectorSearch: {
          index: "face_vector_index",
          path: "visual.face_embedding",
          queryVector: faceEmbedding,
          numCandidates: 50, // Increased for better accuracy
          limit: 3, // Return top 3 matches
          filter: {
            user_id: userIdObj,
            status: "approved"
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

    return atlasMatches.filter(match => match.score >= MATCH_THRESHOLD).map(match => ({
      connection: match,
      score: match.score
    }));

  } catch (e) {
    console.warn("Atlas Vector Search failed. Falling back to brute-force similarity.", e.message);
    
    const allConnections = await Connection.find({
      user_id: userId,
      status: "approved",
      'visual.face_embedding.0': { $exists: true }
    }).select('_id name company visual');

    const matches = allConnections.map(conn => {
      const score = calculateCosineSimilarity(faceEmbedding, conn.visual.face_embedding);
      return { connection: conn, score };
    })
    .filter(match => match.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

    return matches;
  }
}

export function determineMatchAction(matches, draftProfileData) {
  // Simplified MVP: >= 0.80 = update existing, < 0.80 = create new
  if (matches.length === 0 || matches[0].score < MATCH_THRESHOLD) {
    return { action: 'create_new', draft: draftProfileData };
  }

  const bestMatch = matches[0];
  return { action: 'recognized', connection: bestMatch.connection, match_score: bestMatch.score };
}

export async function addFaceEmbeddingToHistory(connectionId, newEmbedding, context = {}) {
  if (!newEmbedding || newEmbedding.length !== 128) {
    console.warn(`Attempted to add invalid embedding to history for connection ${connectionId}`);
    return;
  }

  const connection = await Connection.findById(connectionId);
  if (!connection) {
    throw new Error('Connection not found for updating embedding history.');
  }

  connection.visual.face_embedding_history.push({
    vector: newEmbedding,
    captured_at: new Date(),
    event: context.event?.name,
  });

  if (!connection.visual.face_embedding || connection.visual.face_embedding.length === 0) {
    connection.visual.face_embedding = newEmbedding;
  }

  await connection.save();
}

export { MATCH_THRESHOLD };
