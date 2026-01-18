import Connection from '../models/Connection.js';
import { calculateCosineSimilarity } from './faceEmbeddingService.js';

const MATCH_THRESHOLD = 0.85;
const REVIEW_THRESHOLD = 0.70;

export async function findMatchingConnection(userId, faceEmbedding) {
  if (!faceEmbedding || faceEmbedding.length !== 128) {
    console.warn('Invalid face embedding provided for matching.');
    return [];
  }

  try {
    const atlasMatches = await Connection.aggregate([
      {
        $match: {
          user_id: userId,
          status: "approved",
          'visual.face_embedding.0': { $exists: true }
        }
      },
      {
        $vectorSearch: {
          queryVector: faceEmbedding,
          path: "visual.face_embedding",
          numCandidates: 10,
          limit: 3,
          index: "face_vector_index"
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

    return atlasMatches.filter(match => match.score >= 0.6).map(match => ({
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
    .filter(match => match.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

    return matches;
  }
}

export function determineMatchAction(matches, draftProfileData) {
  if (matches.length === 0 || matches[0].score < REVIEW_THRESHOLD) {
    return { action: 'create_new', draft: draftProfileData };
  }

  const bestMatch = matches[0];

  if (bestMatch.score >= MATCH_THRESHOLD) {
    return { action: 'recognized', connection: bestMatch.connection, match_score: bestMatch.score };
  } else {
    return { action: 'confirm_match', possible_match: bestMatch.connection, match_score: bestMatch.score, draft_profile: draftProfileData };
  }
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

export { MATCH_THRESHOLD, REVIEW_THRESHOLD };
