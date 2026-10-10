const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const Plan = require('../models/Plan');

const router = express.Router();

// ---------------------------------------------------------------------------
// Configuration & constants
// ---------------------------------------------------------------------------
const FREE_PLAN_LIMIT = 3;
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Validate the user profile sent in the request body.
 * @param {object} profile
 * @returns {{valid: boolean, message?: string}}
 */
function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return { valid: false, message: 'Profil manquant ou invalide' };
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
    return { valid: false, message: 'Valeurs du profil hors limites' };
  }

  return { valid: true };
}

/**
 * Check whether the user already reached the free‑plan limit.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function hasReachedFreePlanLimit(userId) {
  const count = await Plan.countDocuments({ userId });
  return count >= FREE_PLAN_LIMIT;
}

/**
 * Build the Gemini prompt according to the requested plan type.
 * @param {'fitness'|'nutrition'} type
 * @param {object} profile
 * @returns {string}
 */
function buildPrompt(type, profile) {
  const { age, taille, poids, goal, level, dietary_preference } = profile;

  const fitnessPrompt = `Génère UNIQUEMENT un JSON valide, sans aucun texte avant ou après, sans markdown, sans \`\`\`.
Plan d'entraînement hebdomadaire sur exactement 7 jours pour ${age} ans, ${taille} cm, ${poids} kg, objectif : ${goal ||
    'général'}, niveau : ${level || 'débutant'}.
Noms de jours obligatoirement : Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche.
Format exact :
{
  "jours": [
    {"jour": "Lundi", "exercices": [{"nom": "string", "series": number, "repetitions": "string", "duree": "string"}, ...]},
    ...
    {"jour": "Dimanche", "exercices": [...]}
  ]
}`;

  const nutritionPrompt = `Génère UNIQUEMENT un JSON valide, sans texte avant/après, sans markdown, sans \`\`\`.
Plan nutritionnel sur exactement 7 jours pour ${age} ans, ${taille} cm, ${poids} kg, objectif : ${goal ||
    'équilibre'}, préférence : ${dietary_preference || 'aucune'}.
Noms de jours en français uniquement.
Format exact :
{
  "jours": [
    {
      "jour": "Lundi",
      "repas": [
        {"nom": "Petit déjeuner", "calories": number, "ingredients": [{"nom": "string", "portion": "string"}, ...]},
        {"nom": "Déjeuner", "calories": number, "ingredients": [...]},
        {"nom": "Dîner", "calories": number, "ingredients": [...]}
      ]
    },
    // exactement 6 jours de plus
  ]
}
Toujours 3 repas par jour. calories entier. portion courte. JSON complet.`;

  return type === 'fitness' ? fitnessPrompt : nutritionPrompt;
}

/**
 * Clean the raw Gemini response, removing possible markdown fences.
 * @param {string} raw
 * @returns {string}
 */
function cleanGeminiResponse(raw) {
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return cleaned;
}

/**
 * Validate the structure of the generated plan.
 * @param {object} planData
 * @param {'fitness'|'nutrition'} type
 * @returns {{valid: boolean, message?: string}}
 */
function validatePlanStructure(planData, type) {
  if (!planData.jours || !Array.isArray(planData.jours) || planData.jours.length !== 7) {
    return {
      valid: false,
      message: `Structure invalide : ${planData.jours?.length || 0} jour(s) au lieu de 7`,
    };
  }

  const validDays = [
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
    'Dimanche',
  ];

  for (const jour of planData.jours) {
    if (!validDays.includes(jour.jour)) {
      return { valid: false, message: `Jour invalide : ${jour.jour}` };
    }

    if (type === 'nutrition') {
      if (!jour.repas || !Array.isArray(jour.repas) || jour.repas.length < 2) {
        return { valid: false, message: `Jour ${jour.jour} : repas manquants` };
      }
    } else {
      if (!jour.exercices || !Array.isArray(jour.exercices)) {
        return { valid: false, message: `Jour ${jour.jour} : exercices manquants` };
      }
    }
  }

  return { valid: true };
}

/**
 * Centralised error response for Gemini failures.
 * @param {object} res Express response
 * @param {Error} err Original error
 */
function handleGeminiError(res, err) {
  console.error('Erreur génération plan (Gemini):', err?.response?.data || err.message);
  const status = err.response?.status || 500;
  res.status(status).json({
    message: status === 429 ? 'Limite Gemini atteinte' : 'Erreur lors de la génération',
    error: err.message,
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET / - Retrieve all plans belonging to the authenticated user.
 */
router.get('/', authMiddleware(), async (req, res) => {
  try {
    const plans = await Plan.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(plans);
  } catch (err) {
    console.error('Erreur récupération plans:', err);
    res.status(500).json({ message: 'Erreur récupération plans', error: err.message });
  }
});

/**
 * GET /check-limit - Verify whether the user has reached the free‑plan quota.
 */
router.get('/check-limit', authMiddleware(), async (req, res) => {
  try {
    const limitReached = await hasReachedFreePlanLimit(req.user.id);
    res.json({ hasReachedLimit: limitReached });
  } catch (err) {
    console.error('Erreur vérification limite:', err);
    res.status(500).json({ message: 'Erreur vérification limite', error: err.message });
  }
});

/**
 * POST /generate - Generate a new plan (fitness or nutrition) using Gemini.
 */
router.post('/generate', authMiddleware(), async (req, res) => {
  const { type, profile } = req.body;

  // ---- Basic validation -------------------------------------------------
  if (!['fitness', 'nutrition'].includes(type)) {
    return res.status(400).json({ message: 'Type invalide (fitness ou nutrition)' });
  }

  const profileCheck = validateProfile(profile);
  if (!profileCheck.valid) {
    return res.status(400).json({ message: profileCheck.message });
  }

  try {
    // ---- Free‑plan limit -------------------------------------------------
    if (await hasReachedFreePlanLimit(req.user.id)) {
      return res.status(403).json({
        message: 'Vous avez déjà 3 plans gratuits. Abonnez-vous pour en créer plus.',
      });
    }

    // ---- Prompt creation -------------------------------------------------
    const prompt = buildPrompt(type, profile);

    // ---- Gemini request --------------------------------------------------
    const response = await axios.post(
      GEMINI_ENDPOINT,
      {
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 3200,
        top_p: 0.95,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const rawContent = response.data.choices?.[0]?.message?.content?.trim() ?? '';
    const cleanedContent = cleanGeminiResponse(rawContent);

    let planData;
    try {
      planData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('[GEMINI PARSE ERROR]', parseError.message);
      console.error('Contenu brut (1200 premiers):', cleanedContent.substring(0, 1200) + '...');
      return res.status(503).json({
        message: 'Gemini n’a pas retourné un JSON valide. Réessayez plus tard.',
        debug:
          process.env.NODE_ENV === 'development'
            ? { preview: cleanedContent.substring(0, 600) }
            : undefined,
      });
    }

    // ---- Structure validation --------------------------------------------
    const structureCheck = validatePlanStructure(planData, type);
    if (!structureCheck.valid) {
      return res.status(503).json({ message: structureCheck.message });
    }

    // ---- Persist the plan -------------------------------------------------
    const plan = new Plan({
      userId: req.user.id,
      type,
      profile,
      plan: planData,
      createdAt: new Date(),
    });

    await plan.save();
    res.json(plan);
  } catch (err) {
    handleGeminiError(res, err);
  }
});

/**
 * DELETE /:id - Remove a plan (admin only).
 */
router.delete('/:id', authMiddleware('admin'), async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ message: 'Plan supprimé' });
  } catch (err) {
    console.error('Erreur suppression:', err);
    res.status(500).json({ message: 'Erreur suppression', error: err.message });
  }
});

module.exports = router;