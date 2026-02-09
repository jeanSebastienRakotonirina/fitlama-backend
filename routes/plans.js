const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const Plan = require('../models/Plan');

const router = express.Router();

// GET /plans → liste des plans de l'utilisateur
router.get('/', authMiddleware(), async (req, res) => {
  try {
    const plans = await Plan.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(plans);
  } catch (err) {
    console.error('Erreur récupération plans:', err);
    res.status(500).json({ message: 'Erreur récupération plans', error: err.message });
  }
});

// GET /plans/check-limit → vérifie si l'utilisateur a atteint la limite gratuite (3 plans)
router.get('/check-limit', authMiddleware(), async (req, res) => {
  try {
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    res.json({ hasReachedLimit: planCount >= 3 });
  } catch (err) {
    console.error('Erreur vérification limite plans:', err);
    res.status(500).json({ message: 'Erreur vérification limite plans', error: err.message });
  }
});

// POST /plans/generate → génération du plan (fitness ou nutrition)
router.post('/generate', authMiddleware(), async (req, res) => {
  const { type, profile } = req.body;

  // ── Validation des entrées ─────────────────────────────────────
  if (!['fitness', 'nutrition'].includes(type)) {
    return res.status(400).json({ message: 'Type de plan invalide (fitness ou nutrition uniquement)' });
  }

  if (!profile || typeof profile !== 'object') {
    return res.status(400).json({ message: 'Profil manquant ou invalide' });
  }

  const { age, taille, poids } = profile;
  if (
    !Number.isInteger(age) || age < 14 || age > 100 ||
    !Number.isInteger(taille) || taille < 100 || taille > 250 ||
    !Number.isInteger(poids) || poids < 30 || poids > 300
  ) {
    return res.status(400).json({ message: 'Valeurs du profil hors limites' });
  }

  try {
    // Vérification de la limite gratuite
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    if (planCount >= 3) {
      return res.status(403).json({
        message: 'Vous avez déjà 3 plans. Abonnez-vous pour générer des plans supplémentaires.'
      });
    }

    // ── Construction du prompt ─────────────────────────────────────
    const prompt = type === 'fitness'
      ? `Générez un plan d'entraînement hebdomadaire (7 jours) pour une personne de ${profile.age} ans, ${profile.taille} cm, ${profile.poids} kg, objectif: ${profile.goal}, niveau: ${profile.level}.
Fournissez UNIQUEMENT un objet JSON valide, sans texte supplémentaire, sans \`\`\`json, sans commentaires.

Format exact :
{
  "jours": [
    { "jour": 1, "exercices": [{ "nom": "", "repetitions": "", "duree": "" }, ...] },
    { "jour": 2, "exercices": [...] },
    ...
    { "jour": 7, "exercices": [...] }
  ]
}`
      : `Générez un plan nutritionnel hebdomadaire (7 jours) pour une personne de ${profile.age} ans, ${profile.taille} cm, ${profile.poids} kg, objectif: ${profile.goal}, préférence alimentaire: ${profile.dietary_preference}.
Fournissez UNIQUEMENT un objet JSON valide, sans texte supplémentaire, sans \`\`\`json, sans commentaires.

Format exact :
{
  "jours": [
    { "jour": 1, "repas": [{ "nom": "", "calories": 0, "ingredients": [{ "nom": "", "portion": "" }] }, ...] },
    ...
  ]
}`;

    // ── Appel à OpenRouter ─────────────────────────────────────────
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 2500
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // ── Extraction robuste du JSON (gère les fences, texte parasite, etc.) ──
    let content = response.data.choices[0].message.content.trim();

    // Supprime les balises markdown courantes
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    // Extrait le premier objet JSON complet
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];

    let planData;
    try {
      planData = JSON.parse(content);
    } catch (parseErr) {
      console.error('LLM JSON invalide:', parseErr, '\nContenu brut:', content);
      return res.status(503).json({ message: 'Le modèle n’a pas renvoyé un JSON valide. Réessayez.' });
    }

    // ── Normalisation du champ "jour" (gère "Lundi" → 1, "Mardi" → 2, etc.) ──
    const dayMap = {
      'Lundi': 1, 'Mardi': 2, 'Mercredi': 3, 'Jeudi': 4, 'Vendredi': 5, 'Samedi': 6, 'Dimanche': 7,
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7,
      'lun': 1, 'mar': 2, 'mer': 3, 'jeu': 4, 'ven': 5, 'sam': 6, 'dim': 7
    };

    if (planData.jours && Array.isArray(planData.jours)) {
      planData.jours = planData.jours.map((day, index) => {
        let jourValue = day.jour;

        if (typeof jourValue === 'string') {
          const normalized = jourValue.trim().toLowerCase();
          jourValue = dayMap[normalized] || dayMap[jourValue] || (index + 1);
        }

        jourValue = Number(jourValue);
        if (isNaN(jourValue) || jourValue < 1 || jourValue > 7) {
          jourValue = index + 1;
        }

        return { ...day, jour: jourValue };
      });
    }

    // ── Sauvegarde dans MongoDB ────────────────────────────────────
    const plan = new Plan({
      userId: req.user.id,
      type,
      profile,
      plan: planData
      // createdAt est géré par le schéma (default: Date.now)
    });

    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error('Erreur génération plan:', err);
    const status = err.response?.status || 500;
    res.status(status).json({
      message: status === 429 ? 'Limite de l’API atteinte, réessayez plus tard' : 'Erreur lors de la génération du plan',
      error: err.message
    });
  }
});

// DELETE /plans/:id → suppression (admin uniquement)
router.delete('/:id', authMiddleware('admin'), async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ message: 'Plan supprimé avec succès' });
  } catch (err) {
    console.error('Erreur suppression plan:', err);
    res.status(500).json({ message: 'Erreur suppression plan', error: err.message });
  }
});

module.exports = router;
