import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['fitness', 'nutrition'], required: true },
  profile: {
    age: Number,
    taille: Number,
    poids: Number,
    goal: String,
    level: String, // Pour fitness
    dietary_preference: String // Pour nutrition
  },
  jours: Array, // Structure JSON des jours (exercices ou repas)
  isPublic: { type: Boolean, default: false }
});

export const Plan = mongoose.model('Plan', planSchema);