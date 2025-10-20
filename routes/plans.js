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
  try {
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    if (planCount >= 3) {
      return res.status(403).json({ message: 'Vous avez déjà 3 plans. Abonnez-vous pour générer des plans supplémentaires.' });
    }

    const prompt = type === 'fitness'
      ? `Générez un plan d'entraînement hebdomadaire (7 jours) pour une personne de ${profile.age} ans, ${profile.taille} cm, ${profile.poids} kg, objectif: ${profile.goal}, niveau: ${profile.level}. Fournissez UNIQUEMENT un objet JSON valide sans texte supplémentaire, sans commentaires, et sans balises de code. Format JSON: { "jours": [{ "jour": 1, "exercices": [{ "nom": "", "repetitions": "", "duree": "" }] }, ...] }`
      : `Générez un plan nutritionnel hebdomadaire (7 jours) pour une personne de ${profile.age} ans, ${profile.taille} cm, ${profile.poids} kg, objectif: ${profile.goal}, préférence alimentaire: ${profile.dietary_preference}. Fournissez UNIQUEMENT un objet JSON valide sans texte supplémentaire, sans commentaires, et sans balises de code. Format JSON: { "jours": [{ "jour": 1, "repas": [{ "nom": "", "calories": 0, "ingredients": [{ "nom": "", "portion": "" }] }] }, ...] }`;

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: process.env.OPENROUTER_MODEL,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const planData = JSON.parse(response.data.choices[0].message.content);

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
    res.status(500).json({ message: 'Erreur génération plan', error: err.message });
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