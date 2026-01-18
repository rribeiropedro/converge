import mongoose from 'mongoose';

const ConnectionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'temporary_draft', 'approved', 'archived'],
    default: 'draft',
    required: true,
  },
  name: {
    value: { type: String, required: true },
    confidence: { type: String, enum: ['high', 'medium', 'low'], required: true },
    source: { type: String, enum: ['livekit', 'manual'], required: true },
  },
  company: {
    value: { type: String, required: true },
    confidence: { type: String, enum: ['high', 'medium', 'low'], required: true },
    source: { type: String, enum: ['livekit', 'manual'], required: true },
  },
  role: {
    value: { type: String, required: false },
    confidence: { type: String, enum: ['high', 'medium', 'low'], required: false },
    source: { type: String, enum: ['livekit', 'manual'], required: false },
  },
  // Education fields at same level as company/role
  institution: {
    value: { type: String, required: false },
    confidence: { type: String, enum: ['high', 'medium', 'low'], required: false },
    source: { type: String, enum: ['livekit', 'manual'], required: false },
  },
  major: {
    value: { type: String, required: false },
    confidence: { type: String, enum: ['high', 'medium', 'low'], required: false },
    source: { type: String, enum: ['livekit', 'manual'], required: false },
  },
  visual: {
    face_embedding: { type: [Number], default: [] },
    face_embedding_history: [{
      vector: { type: [Number], required: true },
      captured_at: { type: Date, default: Date.now },
      event: { type: String, required: false },
      quality_score: { type: Number, required: false }
    }],
    // Text embedding of name + appearance (1536-dim vector from OpenAI)
    appearance_embedding: { type: [Number], default: [] },
    // History of appearance embeddings for tracking changes over time
    appearance_embedding_history: [{
      vector: { type: [Number], required: true },
      captured_at: { type: Date, default: Date.now },
      event: { type: String, required: false },
      description_used: { type: String, required: false }  // Store the text that was embedded
    }],
    appearance: {
      description: { type: String, default: '' },
      distinctive_features: { type: [String], default: [] },
    },
    environment: {
      description: { type: String, default: '' },
      landmarks: { type: [String], default: [] },
    },
    headshot: {
      url: { type: String, required: false },
      base64: { type: String, required: false },
    },
  },
  audio: {
    topics_discussed: { type: [String], default: [] },
    their_challenges: { type: [String], default: [] },
    follow_up_hooks: [{
      type: { type: String, enum: ['resource_share', 'intro_request', 'meeting', 'other'], required: true },
      detail: { type: String, required: true },
      completed: { type: Boolean, default: false },
      completed_at: { type: Date, default: null },
    }],
    personal_details: { type: [String], default: [] },
    transcript_summary: { type: String, default: '' },
  },
  context: {
    event: {
      name: { type: String, required: true },
      type: { type: String, enum: ['hackathon', 'conference', 'meetup', 'other'], required: true },
    },
    location: {
      name: { type: String, required: true },
      city: { type: String, required: true },
    },
    first_met: { type: Date, required: true },
  },
  tags: { type: [String], default: [] },
  industry: { type: String, required: false },
  relationship_type: { type: String, required: false },
  enrichment: {
    linkedin: {
      url: { type: String, required: false },
      id: { type: String, required: false }
    },
    experience: [{
      title: { type: String, required: false },
      company: { type: String, required: false },
      start_date: { type: Date, required: false },
      end_date: { type: Date, required: false },
      description: { type: String, required: false }
    }],
    skills: { type: [String], default: [] }
  },
  needs_review: { type: Boolean, default: false },
  fields_needing_review: { type: [String], default: [] },
  interaction_count: { type: Number, default: 0 },
  last_interaction: { type: Date, default: null },
  last_contacted: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

ConnectionSchema.index({
  "name.value": "text",
  "company.value": "text",
  "audio.topics_discussed": "text",
  "audio.transcript_summary": "text",
  "visual.appearance.description": "text",
  "visual.environment.description": "text",
  "tags": "text",
});

ConnectionSchema.index({ user_id: 1, status: 1 });
ConnectionSchema.index({ user_id: 1, "context.event.name": 1 });
ConnectionSchema.index({ user_id: 1, "context.first_met": -1 });

export default mongoose.model('Connection', ConnectionSchema);
