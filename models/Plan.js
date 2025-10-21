const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['fitness', 'nutrition'], required: true },
  profile: {
    age: Number,
    taille: Number,
    poids: Number,
    goal: String,
    level: String,
    dietary_preference: String
  },
  plan: {
    jours: [{
      jour: Number,
      exercices: [{ nom: String, series: Number, repetitions: Number }],
      repas: [{ type: String, description: String }]
    }]
  },
  isPublic: { type: Boolean, default: false }
});

module.exports = mongoose.model('Plan', planSchema);
