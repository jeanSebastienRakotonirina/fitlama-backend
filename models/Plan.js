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
      jour: { 
        type: String,  // ← Changed from Number to String
        enum: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'], // Optional but recommended
        required: true 
      },
      exercices: [{
        nom: String,
        repetitions: String,
        duree: String,
        completed: { type: Boolean, default: false }
      }],
      repas: [{
        nom: String,
        calories: Number,
        ingredients: [{ nom: String, portion: String }]
      }]
    }]
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Plan', planSchema);
