const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Sub‑schema describing the user's profile information.
 */
const profileSchema = new Schema(
  {
    age: Number,
    taille: Number,
    poids: Number,
    goal: String,
    level: String,
    dietary_preference: String,
  },
  { _id: false } // Embedded document, no separate _id needed
);

/**
 * Sub‑schema for a single exercise entry.
 */
const exerciseSchema = new Schema(
  {
    nom: String,
    repetitions: String,
    duree: String,
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Sub‑schema for a meal ingredient.
 */
const ingredientSchema = new Schema(
  {
    nom: String,
    portion: String,
  },
  { _id: false }
);

/**
 * Sub‑schema for a single meal entry.
 */
const mealSchema = new Schema(
  {
    nom: String,
    calories: Number,
    ingredients: [ingredientSchema],
  },
  { _id: false }
);

/**
 * Sub‑schema representing a day within a plan.
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
    exercices: [exerciseSchema],
    repas: [mealSchema],
  },
  { _id: false }
);

/**
 * Main schema for a user's plan.
 *
 * @typedef {Object} Plan
 * @property {mongoose.Types.ObjectId} userId - Reference to the owning user.
 * @property {string} type - Either 'fitness' or 'nutrition'.
 * @property {Object} profile - Embedded profile information.
 * @property {Object} plan - Container for the weekly schedule.
 * @property {Date} createdAt - Timestamp of creation (automatically set).
 */
const planSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['fitness', 'nutrition'],
      required: true,
    },
    profile: profileSchema,
    plan: {
      jours: [daySchema],
    },
  },
  {
    // Automatically manage createdAt; we keep only this field to preserve the original API.
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
);

/**
 * Export the Mongoose model for external use.
 */
module.exports = mongoose.model('Plan', planSchema);