import mongoose from 'mongoose';

const InteractionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  connection_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Connection',
    required: true,
  },
  type: {
    type: String,
    enum: ['first_meeting', 'follow_up', 'meeting', 'call', 'email', 'other'],
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
  },
  duration_seconds: {
    type: Number,
    required: false,
  },
  transcript_summary: {
    type: String,
    required: false,
  },
  topics_discussed: {
    type: [String],
    default: [],
  },
  new_follow_up_hooks: [{
    type: { type: String, enum: ['resource_share', 'intro_request', 'meeting', 'other'] },
    detail: { type: String },
  }],
  visual_snapshot: {
    appearance_at_time: { type: String, required: false },
    environment_at_time: { type: String, required: false },
    face_embedding: { type: [Number], default: [] },
  },
  context: {
    event: {
      name: { type: String },
      type: { type: String },
    },
    location: {
      name: { type: String },
      city: { type: String },
    },
  },
}, { timestamps: { createdAt: 'created_at' } });

InteractionSchema.index({ connection_id: 1, timestamp: -1 });
InteractionSchema.index({ user_id: 1, timestamp: -1 });

export default mongoose.model('Interaction', InteractionSchema);
