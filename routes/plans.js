const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const Plan = require('../models/Plan');
const router = express.Router();

// Liste des plans de l'utilisateur
router.get('/', authMiddleware(), async (req, res) => {
  try {
    const plans = await Plan.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(plans);
  } catch (err) {
    console.error('Erreur récupération plans:', err);
    res.status(500).json({ message: 'Erreur récupération plans', error: err.message });
  }
});

// Vérifie si limite atteinte (3 plans gratuits)
router.get('/check-limit', authMiddleware(), async (req, res) => {
  try {
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    res.json({ hasReachedLimit: planCount >= 3 });
  } catch (err) {
    console.error('Erreur vérification limite:', err);
    res.status(500).json({ message: 'Erreur vérification limite', error: err.message });
  }
});

// Génération du plan – avec Google Gemini (compatibilité OpenAI)
router.post('/generate', authMiddleware(), async (req, res) => {
  const { type, profile } = req.body;

  // Validation basique (inchangée)
  if (!['fitness', 'nutrition'].includes(type)) {
    return res.status(400).json({ message: 'Type invalide (fitness ou nutrition)' });
  }
  if (!profile || typeof profile !== 'object') {
    return res.status(400).json({ message: 'Profil manquant ou invalide' });
  }

  const { age, taille, poids, goal, level, dietary_preference } = profile;

  if (
    !Number.isInteger(age) || age < 14 || age > 100 ||
    !Number.isInteger(taille) || taille < 100 || taille > 250 ||
    !Number.isInteger(poids) || poids < 30 || poids > 300
  ) {
    return res.status(400).json({ message: 'Valeurs du profil hors limites' });
  }

  try {
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    if (planCount >= 3) {
      return res.status(403).json({
        message: 'Vous avez déjà 3 plans gratuits. Abonnez-vous pour en créer plus.'
      });
    }

    // Prompts (très similaires, mais optimisés pour Gemini – il suit bien les instructions strictes)
    const fitnessPrompt = `Génère UNIQUEMENT un JSON valide, sans aucun texte avant ou après, sans markdown, sans \`\`\`.
Plan d'entraînement hebdomadaire sur exactement 7 jours pour ${age} ans, ${taille} cm, ${poids} kg, objectif : ${goal || 'général'}, niveau : ${level || 'débutant'}.
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
Plan nutritionnel sur exactement 7 jours pour ${age} ans, ${taille} cm, ${poids} kg, objectif : ${goal || 'équilibre'}, préférence : ${dietary_preference || 'aucune'}.
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

    const prompt = type === 'fitness' ? fitnessPrompt : nutritionPrompt;

    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      {
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',  // ← change ici si besoin (gemini-2.5-flash, etc.)
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 3200,           // Gemini tolère bien plus → on monte un peu
        top_p: 0.95
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let content = response.data.choices[0].message.content?.trim() || '';

    // Nettoyage (Gemini est souvent propre, mais on garde la robustesse)
    content = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];

    let planData;
    try {
      planData = JSON.parse(content);
    } catch (parseError) {
      console.error('[GEMINI PARSE ERROR]', parseError.message);
      console.error('Position:', parseError.message.match(/position (\d+)/)?.[1] || 'inconnue');
      console.error('Contenu brut (1200 premiers):', content.substring(0, 1200) + '...');

      return res.status(503).json({
        message: 'Gemini n’a pas retourné un JSON valide. Réessayez plus tard.',
        debug: process.env.NODE_ENV === 'development' ? { preview: content.substring(0, 600) } : undefined
      });
    }

    // Vérifications structurelles (inchangées)
    if (!planData.jours || !Array.isArray(planData.jours) || planData.jours.length !== 7) {
      return res.status(503).json({
        message: `Structure invalide : ${planData.jours?.length || 0} jour(s) au lieu de 7`
      });
    }

    const validDays = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

    for (const jour of planData.jours) {
      if (!validDays.includes(jour.jour)) {
        return res.status(503).json({ message: `Jour invalide : ${jour.jour}` });
      }

      if (type === 'nutrition') {
        if (!jour.repas || !Array.isArray(jour.repas) || jour.repas.length < 2) {
          return res.status(503).json({ message: `Jour ${jour.jour} : repas manquants` });
        }
      } else {
        if (!jour.exercices || !Array.isArray(jour.exercices)) {
          return res.status(503).json({ message: `Jour ${jour.jour} : exercices manquants` });
        }
      }
    }

    // Sauvegarde
    const plan = new Plan({
      userId: req.user.id,
      type,
      profile,
      plan: planData,
      createdAt: new Date()
    });

    await plan.save();
    res.json(plan);

  } catch (err) {
    console.error('Erreur génération plan (Gemini):', err?.response?.data || err.message);
    const status = err.response?.status || 500;
    res.status(status).json({
      message: status === 429 ? 'Limite Gemini atteinte' : 'Erreur lors de la génération',
      error: err.message
    });
  }
});

// Suppression (admin)
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
