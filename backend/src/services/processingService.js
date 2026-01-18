import Connection from '../models/Connection.js';
import Interaction from '../models/Interaction.js';
import { parseTranscript } from './transcriptParser.js';
import { parseVisualData } from './visualParser.js';
import { calculateNeedsReview, getFieldsNeedingReview } from './confidenceService.js';
import { findMatchingConnection, determineMatchAction, addFaceEmbeddingToHistory } from './faceMatching.js';

export async function processNewInteraction(audioInput, visualInput, context, userId) {
  let audioData;
  if (typeof audioInput === 'string' || (audioInput.transcript && !audioInput.profile)) {
    audioData = await parseTranscript(audioInput.transcript || audioInput);
  } else {
    audioData = audioInput;
  }

  let visualData = await parseVisualData(visualInput);

  if (!visualData.face_embedding || visualData.face_embedding.length === 0) {
    console.warn('No face embedding generated. Creating new connection.');
    const draft = await createDraftConnection(audioData, visualData, context, userId);
    return { type: 'new', draft };
  }

  // Check for matching face first
  const matches = await findMatchingConnection(userId, visualData.face_embedding);
  
  // Simplified MVP: >= 0.80 = update existing, < 0.80 = create new
  if (matches.length > 0 && matches[0].score >= 0.80) {
    // Match found - update existing connection
    const existingConnection = await addInteractionToExistingConnection(
      matches[0].connection._id,
      audioData,
      visualData,
      context,
      userId
    );
    return {
      type: 'recognized',
      connection: existingConnection,
      interaction: existingConnection.latestInteraction,
      match_score: matches[0].score,
      message: `Recognized ${existingConnection.name.value}! Added new interaction.`
    };
  }

  // No match or score < 0.80 - create new connection
  const draft = await createDraftConnection(audioData, visualData, context, userId);
  return { type: 'new', draft };
}

export async function createDraftConnection(audioData, visualData, context, userId) {
  const needsReview = calculateNeedsReview(audioData);
  const fieldsNeedingReview = getFieldsNeedingReview(audioData);

  const connectionData = {
    user_id: userId,
    status: 'draft',
    name: {
      value: audioData.profile.name?.value || 'Unknown',
      confidence: audioData.profile.name?.confidence || 'low',
      source: 'livekit',
    },
    company: {
      value: audioData.profile.company?.value || 'Unknown',
      confidence: audioData.profile.company?.confidence || 'low',
      source: 'livekit',
    },
    role: {
      value: audioData.profile.role?.value || null,
      confidence: audioData.profile.role?.confidence || 'low',
      source: 'livekit',
    },
    visual: {
      face_embedding: visualData.face_embedding || [],
      face_embedding_history: visualData.face_embedding?.length === 128 
        ? [{ vector: visualData.face_embedding, captured_at: new Date(), event: context.event?.name }] 
        : [],
      appearance: visualData.appearance,
      environment: visualData.environment,
      headshot: visualData.headshot,
    },
    audio: {
      topics_discussed: audioData.topics_discussed || [],
      their_challenges: audioData.their_challenges || [],
      follow_up_hooks: (audioData.follow_up_hooks || []).map(hook => ({
        type: hook.type,
        detail: hook.detail,
        completed: false,
        completed_at: null,
      })),
      personal_details: audioData.personal_details || [],
      transcript_summary: audioData.transcript_summary || '',
    },
    context: {
      event: {
        name: context.event?.name || 'Unknown Event',
        type: context.event?.type || 'other',
      },
      location: {
        name: context.location?.name || 'Unknown',
        city: context.location?.city || 'Unknown',
      },
      first_met: new Date(),
    },
    needs_review: needsReview,
    fields_needing_review: fieldsNeedingReview,
    interaction_count: 0,
    last_interaction: null,
  };

  const connection = new Connection(connectionData);
  await connection.save();
  return connection;
}

export async function addInteractionToExistingConnection(connectionId, audioData, visualData, context, userId) {
  const connection = await Connection.findById(connectionId);
  if (!connection) throw new Error('Connection not found');
  if (connection.user_id.toString() !== userId.toString()) throw new Error('Unauthorized');

  if (visualData.face_embedding && visualData.face_embedding.length === 128) {
    await addFaceEmbeddingToHistory(connectionId, visualData.face_embedding, context);
  }

  const newTopics = audioData.topics_discussed || [];
  connection.audio.topics_discussed = Array.from(new Set([...connection.audio.topics_discussed, ...newTopics]));

  const newHooks = (audioData.follow_up_hooks || []).map(hook => ({ ...hook, completed: false, completed_at: null }));
  connection.audio.follow_up_hooks.push(...newHooks);

  connection.last_interaction = new Date();
  connection.interaction_count += 1;

  const confidenceOrder = { 'low': 1, 'medium': 2, 'high': 3 };
  ['name', 'company', 'role'].forEach(field => {
    const currentField = connection[field];
    const newField = audioData.profile?.[field];
    if (newField?.value && (!currentField?.value || confidenceOrder[newField.confidence] > confidenceOrder[currentField.confidence])) {
      connection[field] = { ...newField, source: 'livekit' };
    }
  });

  const combinedAudioData = { profile: { name: connection.name, company: connection.company, role: connection.role } };
  connection.needs_review = calculateNeedsReview(combinedAudioData);
  connection.fields_needing_review = getFieldsNeedingReview(combinedAudioData);

  await connection.save();

  const latestInteraction = await createInteractionRecord(userId, connectionId, audioData, visualData, context);
  connection.latestInteraction = latestInteraction;
  return connection;
}

export async function createInteractionRecord(userId, connectionId, audioData, visualData, context) {
  const interaction = new Interaction({
    user_id: userId,
    connection_id: connectionId,
    type: 'follow_up',
    timestamp: new Date(),
    duration_seconds: visualData.duration_seconds || 0,
    transcript_summary: audioData.transcript_summary,
    topics_discussed: audioData.topics_discussed,
    new_follow_up_hooks: audioData.follow_up_hooks,
    visual_snapshot: {
      appearance_at_time: visualData.appearance?.description,
      environment_at_time: visualData.environment?.description,
      face_embedding: visualData.face_embedding,
    },
    context: context,
  });
  await interaction.save();
  return interaction;
}

export async function approveConnection(connectionId, updates = {}) {
  const connection = await Connection.findById(connectionId);
  if (!connection) throw new Error('Connection not found');
  if (connection.status !== 'draft') {
    throw new Error('Only draft connections can be approved');
  }

  for (const [path, value] of Object.entries(updates)) {
    const keys = path.split('.');
    let current = connection;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  connection.status = 'approved';
  connection.needs_review = false;
  connection.fields_needing_review = [];
  await connection.save();
  return connection;
}

export async function getConnections(userId, options = {}) {
  const { status, search, event, limit = 20, offset = 0 } = options;
  const query = { user_id: userId };
  if (status) query.status = status;
  if (event) query['context.event.name'] = event;

  let connectionsQuery = Connection.find(query);
  if (search) {
    connectionsQuery = Connection.find({ ...query, $text: { $search: search } });
  }

  const connections = await connectionsQuery.sort({ 'context.first_met': -1 }).skip(offset).limit(limit);
  const total = await Connection.countDocuments(query);
  return { connections, total, limit, offset };
}

export async function getConnectionById(connectionId) {
  const connection = await Connection.findById(connectionId);
  if (!connection) throw new Error('Connection not found');
  return connection;
}

export async function deleteConnection(connectionId) {
  const connection = await Connection.findByIdAndDelete(connectionId);
  if (!connection) throw new Error('Connection not found');
  return { deleted: true };
}
