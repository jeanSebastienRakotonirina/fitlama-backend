const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Sub‑schema representing an ingredient used in a meal.
 */
const IngredientSchema = new Schema(
  {
    nom: { type: String, required: true },
    portion: { type: String, required: true },
  },
  { _id: false } // Embedded documents do not need their own _id
);

/**
 * Sub‑schema representing a meal within a day plan.
 */
const MealSchema = new Schema(
  {
    nom: { type: String, required: true },
    calories: { type: Number, required: true },
    ingredients: { type: [IngredientSchema], default: [] },
  },
  { _id: false }
);

/**
 * Sub‑schema representing an exercise within a day plan.
 */
const ExerciseSchema = new Schema(
  {
    nom: { type: String, required: true },
    repetitions: { type: String, required: true },
    duree: { type: String, required: true },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Sub‑schema representing a single day of the plan.
 */
const DaySchema = new Schema(
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
    exercices: { type: [ExerciseSchema], default: [] },
    repas: { type: [MealSchema], default: [] },
  },
  { _id: false }
);

/**
 * Sub‑schema representing the user's profile information attached to a plan.
 */
const ProfileSchema = new Schema(
  {
    age: Number,
    taille: Number,
    poids: Number,
    goal: String,
    level: String,
    dietary_preference: String,
  },
  { _id: false }
);

/**
 * Main schema for a fitness or nutrition plan.
 *
 * Fields:
 * - userId: reference to the owning user (required)
 * - type: either 'fitness' or 'nutrition' (required)
 * - profile: optional user profile data
 * - plan: array of days, each containing exercises and meals
 * - createdAt: timestamp automatically set on document creation
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
    profile: { type: ProfileSchema, default: {} },
    plan: {
      jours: { type: [DaySchema], default: [] },
    },
  },
  {
    // Automatically manage createdAt (no updatedAt needed to keep original behaviour)
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
);

module.exports = mongoose.model('Plan', planSchema);