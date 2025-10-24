import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['fitness', 'nutrition'], required: true },
  profile: {
    age: Number,
    height: Number,
    weight: Number,
    goal: String,
    level: String,
    dietary_preference: String
  },
  jours: [{ type: Object }],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Plan = mongoose.model('Plan', planSchema);