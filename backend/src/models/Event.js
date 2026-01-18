import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['hackathon', 'conference', 'meetup', 'other'],
    required: true,
  },
  location: {
    name: { type: String, required: true },
    city: { type: String, required: true },
  },
  date_start: {
    type: Date,
    required: true,
  },
  date_end: {
    type: Date,
    required: true,
  },
  connection_count: {
    type: Number,
    default: 0,
  },
});

EventSchema.index({ user_id: 1, name: 1 });

export default mongoose.model('Event', EventSchema);
