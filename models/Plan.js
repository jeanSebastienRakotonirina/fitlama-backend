import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['fitness', 'nutrition'], required: true },
  profile: {
    age: { type: Number, required: true },
    taille: { type: Number, required: true },
    poids: { type: Number, required: true },
    goal: { type: String, required: true },
    level: { type: String },
    dietary_preference: { type: String }
  },
  jours: [{ type: Object }],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Plan = mongoose.model('Plan', planSchema);