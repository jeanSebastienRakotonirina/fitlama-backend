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

// Génération du plan
router.post('/generate', authMiddleware(), async (req, res) => {
  const { type, profile } = req.body;

  // Validation basique
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

    // Prompts renforcés et plus compacts
    const fitnessPrompt = `Génère UNIQUEMENT un JSON valide pour un plan d'entraînement hebdomadaire (7 jours) pour une personne de ${age} ans, ${taille} cm, ${poids} kg, objectif : ${goal || 'général'}, niveau : ${level || 'débutant'}.
Noms de jours obligatoirement en français : Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche.
Format exact (rien d'autre) :
{
  "jours": [
    {"jour": "Lundi", "exercices": [{"nom": "...", "repetitions": "...", "duree": "...", "series": ...}, ...]},
    {"jour": "Mardi", "exercices": [...]},
    ...
    {"jour": "Dimanche", "exercices": [...]}
  ]
}
JSON complet, valide, sans texte avant/après, sans markdown, sans commentaires.`;

    const nutritionPrompt = `Génère UNIQUEMENT un JSON valide pour un plan nutritionnel hebdomadaire (exactement 7 jours) pour une personne de ${age} ans, ${taille} cm, ${poids} kg, objectif : ${goal || 'équilibre'}, préférence : ${dietary_preference || 'aucune'}.
Noms de jours en français uniquement : Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche.
Format exact (rien d'autre) :
{
  "jours": [
    {
      "jour": "Lundi",
      "repas": [
        {"nom": "Petit déjeuner", "calories": NNN, "ingredients": [{"nom": "...", "portion": "..."}, ...]},
        {"nom": "Déjeuner", "calories": NNN, "ingredients": [...]},
        {"nom": "Dîner", "calories": NNN, "ingredients": [...]}
      ]
    },
    // exactement 6 jours supplémentaires identiques en structure
  ]
}
Toujours 3 repas par jour. calories = entier. portion = chaîne courte. JSON complet et valide, sans texte supplémentaire ni markdown.`;

    const prompt = type === 'fitness' ? fitnessPrompt : nutritionPrompt;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,           // plus bas = plus déterministe
        max_tokens: 2800,           // augmentation significative
        top_p: 0.9
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let content = response.data.choices[0].message.content?.trim() || '';

    // Nettoyage agressif
    content = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/^\s*{\s*/, '{')
      .replace(/\s*}\s*$/, '}');

    // Extraction du bloc JSON le plus probable
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    let planData;
    try {
      planData = JSON.parse(content);
    } catch (parseError) {
      console.error('[PARSE ERROR] Message:', parseError.message);
      console.error('[PARSE ERROR] Position:', parseError.message.match(/position (\d+)/)?.[1] || 'inconnue');
      console.error('[PARSE ERROR] Contenu brut (premiers 1200 caractères):');
      console.error(content.substring(0, 1200) + (content.length > 1200 ? '...' : ''));

      return res.status(503).json({
        message: 'Le modèle n’a pas retourné un JSON valide ou complet. Veuillez réessayer.',
        debug: process.env.NODE_ENV === 'development' ? { rawPreview: content.substring(0, 600) } : undefined
      });
    }

    // Vérifications structurelles renforcées
    if (!planData.jours || !Array.isArray(planData.jours) || planData.jours.length !== 7) {
      return res.status(503).json({
        message: `Structure invalide : ${planData.jours?.length || 0} jour(s) au lieu de 7`
      });
    }

    const validDays = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

    for (const jour of planData.jours) {
      if (!validDays.includes(jour.jour)) {
        return res.status(503).json({ message: `Nom de jour invalide : ${jour.jour}` });
      }

      if (type === 'nutrition') {
        if (!jour.repas || !Array.isArray(jour.repas) || jour.repas.length < 2) {
          return res.status(503).json({ message: `Jour ${jour.jour} : repas manquants ou invalides` });
        }
      } else if (type === 'fitness') {
        if (!jour.exercices || !Array.isArray(jour.exercices)) {
          return res.status(503).json({ message: `Jour ${jour.jour} : exercices manquants` });
        }
      }
    }

    // Tout est OK → sauvegarde
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
    console.error('Erreur génération plan:', err);
    const status = err.response?.status || 500;
    res.status(status).json({
      message: status === 429 ? 'Limite API atteinte' : 'Erreur lors de la génération du plan',
      error: err.message
    });
  }
});

// Suppression (admin seulement)
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
