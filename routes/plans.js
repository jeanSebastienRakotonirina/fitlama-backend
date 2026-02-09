const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const Plan = require('../models/Plan');
const router = express.Router();
router.get('/', authMiddleware(), async (req, res) => {
  try {
    const plans = await Plan.find({ userId: req.user.id });
    res.json(plans);
  } catch (err) {
    console.error('Erreur récupération plans:', err);
    res.status(500).json({ message: 'Erreur récupération plans', error: err.message });
  }
});
router.get('/check-limit', authMiddleware(), async (req, res) => {
  try {
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    res.json({ hasReachedLimit: planCount >= 3 });
  } catch (err) {
    console.error('Erreur vérification limite plans:', err);
    res.status(500).json({ message: 'Erreur vérification limite plans', error: err.message });
  }
});
router.post('/generate', authMiddleware(), async (req, res) => {
  const { type, profile } = req.body;

  // ── Validation ──────────────────────────────────────────────
  if (!['fitness', 'nutrition'].includes(type)) {
    return res.status(400).json({ message: 'Type de plan invalide' });
  }

  if (!profile?.age || !profile?.taille || !profile?.poids) {
    return res.status(400).json({ message: 'Profil incomplet' });
  }

  // Add more checks as needed...

  try {
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    if (planCount >= 3) {
      return res.status(403).json({
        message: 'Vous avez déjà 3 plans. Abonnez-vous pour en créer davantage.'
      });
    }

    // ── Prompt building ─────────────────────────────────────────
    const prompt = type === 'fitness'
      ? `Générez un plan d'entraînement hebdomadaire (7 jours) pour une personne de ${profile.age} ans, ${profile.taille} cm, ${profile.poids} kg, objectif: ${profile.goal}, niveau: ${profile.level}. Fournissez UNIQUEMENT un objet JSON valide sans texte supplémentaire...`
      : `Générez un plan nutritionnel hebdomadaire ...`; // your existing prompt

const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
  model: process.env.OPENROUTER_MODEL,
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.2, // lower = more deterministic

  response_format: {
    type: 'json_schema',
    json_schema: {
      name: type === 'fitness' ? 'weekly_fitness_plan' : 'weekly_nutrition_plan',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          jours: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                jour: {
                  type: 'integer',           // ← enforced as number
                  minimum: 1,
                  maximum: 7,
                  description: '1 = Lundi, 2 = Mardi, ..., 7 = Dimanche'
                },
                exercices: {                 // for fitness
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nom: { type: 'string' },
                      repetitions: { type: 'string' },
                      duree: { type: 'string' }
                    },
                    required: ['nom'],
                    additionalProperties: true // allow completed etc.
                  }
                },
                repas: {                     // for nutrition – can be empty for fitness
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nom: { type: 'string' },
                      calories: { type: 'number' },
                      ingredients: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            nom: { type: 'string' },
                            portion: { type: 'string' }
                          }
                        }
                      }
                    },
                    required: ['nom']
                  }
                }
              },
              required: ['jour'],
              additionalProperties: false
            },
            minItems: 7,
            maxItems: 7
          }
        },
        required: ['jours'],
        additionalProperties: false
      }
    }
  }
}, {
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  }
});
    // ── Robust JSON extraction ──────────────────────────────────
    let content = response.data.choices[0].message.content.trim();
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    const match = content.match(/\{[\s\S]*\}/);
    if (match) content = match[0];

    const planData = JSON.parse(content);

    // Optional: basic structural validation
    if (!planData?.jours?.length) {
      throw new Error('Structure JSON invalide');
    }

    const plan = new Plan({
      userId: req.user.id,
      type,
      profile,
      plan: planData,
      // createdAt: auto if timestamps: true
    });

    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error('Erreur génération plan:', err);
    const status = err.response?.status || 500;
    res.status(status).json({
      message: status === 429 ? 'Limite de l’API atteinte' : 'Erreur lors de la génération',
      error: err.message
    });
  }
});
router.delete('/:id', authMiddleware('admin'), async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ message: 'Plan supprimé' });
  } catch (err) {
    console.error('Erreur suppression plan:', err);
    res.status(500).json({ message: 'Erreur suppression plan', error: err.message });
  }
});
module.exports = router;
