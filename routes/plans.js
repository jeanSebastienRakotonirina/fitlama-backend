const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const Plan = require('../models/Plan');

const router = express.Router();

/**
 * Retrieve all plans for the authenticated user.
 */
router.get(
  '/',
  authMiddleware(),
  async (req, res) => {
    try {
      const plans = await Plan.find({ userId: req.user.id }).sort({ createdAt: -1 });
      res.json(plans);
    } catch (err) {
      console.error('Erreur récupération plans:', err);
      res.status(500).json({ message: 'Erreur récupération plans', error: err.message });
    }
  }
);

/**
 * Check whether the user has reached the free‑plan limit (3 plans).
 */
router.get(
  '/check-limit',
  authMiddleware(),
  async (req, res) => {
    try {
      const planCount = await Plan.countDocuments({ userId: req.user.id });
      res.json({ hasReachedLimit: planCount >= 3 });
    } catch (err) {
      console.error('Erreur vérification limite:', err);
      res.status(500).json({ message: 'Erreur vérification limite', error: err.message });
    }
  }
);

/**
 * Validate the profile payload.
 * @param {object} profile
 * @returns {string|null} Error message or null if valid.
 */
function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return 'Profil manquant ou invalide';
  }

  const { age, taille, poids } = profile;

  if (
    !Number.isInteger(age) ||
    age < 14 ||
    age > 100 ||
    !Number.isInteger(taille) ||
    taille < 100 ||
    taille > 250 ||
    !Number.isInteger(poids) ||
    poids < 30 ||
    poids > 300
  ) {
    return 'Valeurs du profil hors limites';
  }

  return null;
}

/**
 * Build the Gemini prompt according to the requested plan type.
 * @param {string} type - 'fitness' or 'nutrition'
 * @param {object} profile
 * @returns {string}
 */
function buildPrompt(type, profile) {
  const { age, taille, poids, goal, level, dietary_preference } = profile;

  if (type === 'fitness') {
    return `Génère UNIQUEMENT un JSON valide, sans aucun texte avant ou après, sans markdown, sans \`\`\`.
Plan d'entraînement hebdomadaire sur exactement 7 jours pour ${age} ans, ${taille} cm, ${poids} kg, objectif : ${goal || 'général'}, niveau : ${level || 'débutant'}.
Noms de jours obligatoirement : Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche.
Format exact :
{
  "jours": [
    {"jour": "Lundi", "exercices": [{"nom": "string", "series": number, "repetitions": "string", "duree": "string"}, ...]},
    {"jour": "Mardi", "exercices": [{"nom": "string", "series": number, "repetitions": "string", "duree": "string"}, ...]},
    {"jour": "Mercredi", "exercices": [{"nom": "string", "series": number, "repetitions": "string", "duree": "string"}, ...]},
    {"jour": "Jeudi", "exercices": [{"nom": "string", "series": number, "repetitions": "string", "duree": "string"}, ...]},
    {"jour": "Vendredi", "exercices": [{"nom": "string", "series": number, "repetitions": "string", "duree": "string"}, ...]},
    {"jour": "Samedi", "exercices": [{"nom": "string", "series": number, "repetitions": "string", "duree": "string"}, ...]},
    {"jour": "Dimanche", "exercices": [{"nom": "string", "series": number, "repetitions": "string", "duree": "string"}, ...]}
  ]
}`;
  }

  // nutrition
  return `Génère UNIQUEMENT un JSON valide, sans texte avant/après, sans markdown, sans \`\`\`.
Plan nutritionnel sur exactement 7 jours pour ${age} ans, ${taille} cm, ${poids} kg, objectif : ${goal || 'équilibre'}, préférence : ${dietary_preference || 'aucune'}.
Noms de jours en français uniquement.
Format exact :
{
  "jours": [
    {
      "jour": "Lundi",
      "repas": [
        {"nom": "Petit déjeuner", "calories": number, "ingredients": [{"nom": "string", "portion": "string"}, ...]},
        {"nom": "Déjeuner", "calories": number, "ingredients": [{"nom": "string", "portion": "string"}, ...]},
        {"nom": "Dîner", "calories": number, "ingredients": [{"nom": "string", "portion": "string"}, ...]}
      ]
    },
    {
      "jour": "Mardi",
      "repas": [
        {"nom": "Petit déjeuner", "calories": number, "ingredients": [{"nom": "string", "portion": "string"}, ...]},
        {"nom": "Déjeuner", "calories": number, "ingredients": [{"nom": "string", "portion": "string"}, ...]},
        {"nom": "Dîner", "calories": number, "ingredients": [{"nom": "string", "portion": "string"}, ...]}
      ]
    },
    // ... exactement 5 jours supplémentaires identiques
  ]
}
Toujours 3 repas par jour. calories entier. portion courte. JSON complet.`;
}

/**
 * Clean and extract JSON from Gemini response.
 * @param {string} rawContent
 * @returns {string} JSON string
 */
function extractJson(rawContent) {
  let content = rawContent?.trim() ?? '';

  // Remove possible markdown fences
  content = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Keep only the first JSON object found
  const match = content.match(/\{[\s\S]*\}/);
  return match ? match[0] : content;
}

/**
 * Validate the structure of the generated plan.
 * @param {object} planData
 * @param {string} type
 * @returns {string|null} Error message or null if valid.
 */
function validatePlanStructure(planData, type) {
  if (!planData.jours || !Array.isArray(planData.jours) || planData.jours.length !== 7) {
    return `Structure invalide : ${planData.jours?.length || 0} jour(s) au lieu de 7`;
  }

  const validDays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  for (const jour of planData.jours) {
    if (!validDays.includes(jour.jour)) {
      return `Jour invalide : ${jour.jour}`;
    }

    if (type === 'nutrition') {
      if (!jour.repas || !Array.isArray(jour.repas) || jour.repas.length < 2) {
        return `Jour ${jour.jour} : repas manquants`;
      }
    } else {
      if (!jour.exercices || !Array.isArray(jour.exercices)) {
        return `Jour ${jour.jour} : exercices manquants`;
      }
    }
  }

  return null;
}

/**
 * Generate a new plan using Gemini.
 */
router.post(
  '/generate',
  authMiddleware(),
  async (req, res) => {
    const { type, profile } = req.body;

    // Basic type validation
    if (!['fitness', 'nutrition'].includes(type)) {
      return res.status(400).json({ message: 'Type invalide (fitness ou nutrition)' });
    }

    // Profile validation
    const profileError = validateProfile(profile);
    if (profileError) {
      return res.status(400).json({ message: profileError });
    }

    try {
      const planCount = await Plan.countDocuments({ userId: req.user.id });
      if (planCount >= 3) {
        return res.status(403).json({
          message: 'Vous avez déjà 3 plans gratuits. Abonnez-vous pour en créer plus.'
        });
      }

      const prompt = buildPrompt(type, profile);
      const geminiResponse = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        {
          model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 3200,
          top_p: 0.95
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const rawContent = geminiResponse.data?.choices?.[0]?.message?.content ?? '';
      const jsonString = extractJson(rawContent);

      let planData;
      try {
        planData = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('[GEMINI PARSE ERROR]', parseError.message);
        console.error('Contenu brut (1200 premiers):', jsonString.substring(0, 1200) + '...');
        return res.status(503).json({
          message: 'Gemini n’a pas retourné un JSON valide. Réessayez plus tard.',
          debug: process.env.NODE_ENV === 'development' ? { preview: jsonString.substring(0, 600) } : undefined
        });
      }

      const structureError = validatePlanStructure(planData, type);
      if (structureError) {
        return res.status(503).json({ message: structureError });
      }

      const newPlan = new Plan({
        userId: req.user.id,
        type,
        profile,
        plan: planData,
        createdAt: new Date()
      });

      await newPlan.save();
      res.json(newPlan);
    } catch (err) {
      console.error('Erreur génération plan (Gemini):', err?.response?.data || err.message);
      const status = err.response?.status || 500;
      res.status(status).json({
        message: status === 429 ? 'Limite Gemini atteinte' : 'Erreur lors de la génération',
        error: err.message
      });
    }
  }
);

/**
 * Delete a plan (admin only).
 */
router.delete(
  '/:id',
  authMiddleware('admin'),
  async (req, res) => {
    try {
      await Plan.findByIdAndDelete(req.params.id);
      res.json({ message: 'Plan supprimé' });
    } catch (err) {
      console.error('Erreur suppression:', err);
      res.status(500).json({ message: 'Erreur suppression', error: err.message });
    }
  }
);

module.exports = router;