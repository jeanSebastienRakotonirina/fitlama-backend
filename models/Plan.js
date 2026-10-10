const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Sub‑schema representing an ingredient used in a meal.
 */
const ingredientSchema = new Schema(
  {
    nom: { type: String, required: true },
    portion: { type: String, required: true },
  },
  { _id: false } // Ingredients are embedded, no separate _id needed.
);

/**
 * Sub‑schema representing a meal within a day plan.
 */
const mealSchema = new Schema(
  {
    nom: { type: String, required: true },
    calories: { type: Number, min: 0 },
    ingredients: { type: [ingredientSchema], default: [] },
  },
  { _id: false }
);

/**
 * Sub‑schema representing an exercise within a day plan.
 */
const exerciseSchema = new Schema(
  {
    nom: { type: String, required: true },
    repetitions: { type: String },
    duree: { type: String },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Sub‑schema representing a single day in the plan.
 */
const daySchema = new Schema(
  {
    jour: {
      type: String,
      enum: [
        'Lundi',
        'Mardi',
        'Mercredi',
        'Jeudi',
        'Vendredi',
        'Samedi',
        'Dimanche',
      ],
      required: true,
    },
    exercices: { type: [exerciseSchema], default: [] },
    repas: { type: [mealSchema], default: [] },
  },
  { _id: false }
);

/**
 * Main schema for a user's fitness / nutrition plan.
 */
const planSchema = new Schema(
  {
    /** Reference to the user owning this plan. */
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /** Type of plan – either fitness‑oriented or nutrition‑oriented. */
    type: {
      type: String,
      enum: ['fitness', 'nutrition'],
      required: true,
    },

    /** Basic profile information of the user at plan creation time. */
    profile: {
      age: { type: Number, min: 0 },
      taille: { type: Number, min: 0 }, // Height in cm
      poids: { type: Number, min: 0 }, // Weight in kg
      goal: { type: String },
      level: { type: String },
      dietary_preference: { type: String },
    },

    /** Detailed weekly plan, composed of days. */
    plan: {
      jours: { type: [daySchema], default: [] },
    },

    /** Creation timestamp (automatically set). */
    createdAt: { type: Date, default: Date.now },
  },
  {
    // Ensure strict schema enforcement and add useful collection options.
    strict: true,
    versionKey: false,
  }
);

/**
 * Export the Mongoose model for external use.
 * @type {mongoose.Model}
 */
module.exports = mongoose.model('Plan', planSchema);