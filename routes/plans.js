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

  const { age, taille, poids } = profile;
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

    // Prompt (très clair sur le fait qu'on veut des noms de jours en français)
    const prompt = type === 'fitness'
      ? `Générez un plan d'entraînement hebdomadaire sur 7 jours pour une personne de ${profile.age} ans, ${profile.taille} cm, ${profile.poids} kg, objectif : ${profile.goal}, niveau : ${profile.level}.

Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant/après, sans \`\`\`json, sans commentaires.

Utilise obligatoirement les noms de jours en français pour le champ "jour" : "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche".

Format exact attendu :
{
  "jours": [
    { "jour": "Lundi", "exercices": [{ "nom": "...", "repetitions": "...", "duree": "..." }, ...] },
    { "jour": "Mardi", "exercices": [...] },
    ...
    { "jour": "Dimanche", "exercices": [...] }
  ]
}`
      : `Générez un plan nutritionnel hebdomadaire sur 7 jours pour une personne de ${profile.age} ans, ${profile.taille} cm, ${profile.poids} kg, objectif : ${profile.goal}, préférence alimentaire : ${profile.dietary_preference}.

Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant/après, sans \`\`\`json, sans commentaires.

Utilise obligatoirement les noms de jours en français pour le champ "jour" : "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche".

Format exact attendu :
{
  "jours": [
    { "jour": "Lundi", "repas": [{ "nom": "...", "calories": 0, "ingredients": [{ "nom": "...", "portion": "..." }] }, ...] },
    ...
  ]
}`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.25,
        max_tokens: 2500
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let content = response.data.choices[0].message.content.trim();

    // Nettoyage robuste
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const match = content.match(/\{[\s\S]*\}/);
    if (match) content = match[0];

    let planData;
    try {
      planData = JSON.parse(content);
    } catch (e) {
      console.error('Parse JSON échoué:', e, '\nContenu brut:', content);
      return res.status(503).json({ message: 'Le modèle n’a pas retourné un JSON valide. Réessayez.' });
    }

    // Vérification minimale de structure
    if (!planData.jours || !Array.isArray(planData.jours) || planData.jours.length !== 7) {
      return res.status(503).json({ message: 'Structure du plan invalide (7 jours attendus)' });
    }

    const plan = new Plan({
      userId: req.user.id,
      type,
      profile,
      plan: planData
    });

    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error('Erreur génération plan:', err);
    const status = err.response?.status || 500;
    res.status(status).json({
      message: status === 429 ? 'Limite API atteinte' : 'Erreur lors de la génération',
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
