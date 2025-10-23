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
  plan: {
    jours: [{
      type: mongoose.Schema.Types.Mixed
    }]
  },
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

planSchema.pre('save', function (next) {
  if (!this.plan || !Array.isArray(this.plan.jours)) {
    return next(new Error('Le champ plan.jours doit être un tableau'));
  }

  for (const jour of this.plan.jours) {
    if (this.type === 'fitness') {
      if (!jour.exercices || !Array.isArray(jour.exercices)) {
        return next(new Error('Les plans fitness doivent contenir un tableau exercices'));
      }
      for (const exercice of jour.exercices) {
        if (!exercice.nom || !exercice.series || !exercice.repetitions) {
          return next(new Error('Chaque exercice doit avoir un nom, des séries et des répétitions'));
        }
      }
    } else if (this.type === 'nutrition') {
      if (!jour.repas || !Array.isArray(jour.repas)) {
        return next(new Error('Les plans nutrition doivent contenir un tableau repas'));
      }
      for (const repas of jour.repas) {
        if (!repas.type || !repas.description) {
          return next(new Error('Chaque repas doit avoir un type et une description'));
        }
      }
    }
  }
  next();
});

export const Plan = mongoose.model('Plan', planSchema);