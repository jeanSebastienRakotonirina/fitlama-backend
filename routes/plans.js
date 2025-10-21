const express = require('express');
const router = express.Router();
const Plan = require('../models/Plan');
const auth = require('../middleware/auth');
const axios = require('axios');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

router.post('/generate', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const subscription = await Subscription.findOne({ userId: req.user.id });
    const planCount = await Plan.countDocuments({ userId: req.user.id });

    if (planCount > 0 && (!subscription || !subscription.isActive)) {
      return res.status(403).json({ message: 'Abonnement requis pour générer plus de plans' });
    }

    const { type, profile, isPublic } = req.body;
    const prompt = `Générer un plan de ${type} pour une personne de ${profile.age} ans, ${profile.taille} cm, ${profile.poids} kg, objectif: ${profile.goal}, ${type === 'nutrition' ? 'préférence alimentaire: ' + profile.dietary_preference : 'niveau: ' + profile.level}`;
    
    const response = await axios.post('https://api.openrouter.ai/v1/plan', { prompt }, {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
    });

    const plan = new Plan({
      userId: req.user.id,
      type,
      profile,
      plan: response.data.plan,
      isPublic
    });

    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    console.error('Erreur génération plan:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 2;
    const skip = (page - 1) * limit;

    const plans = await Plan.find({ userId: req.user.id })
      .skip(skip)
      .limit(limit);
    const total = await Plan.countDocuments({ userId: req.user.id });

    res.json({ plans, total });
  } catch (error) {
    console.error('Erreur récupération plans:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 2;
    const skip = (page - 1) * limit;

    const plans = await Plan.find()
      .skip(skip)
      .limit(limit);
    const total = await Plan.countDocuments();

    res.json({ plans, total });
  } catch (error) {
    console.error('Erreur récupération tous les plans:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/count', auth, async (req, res) => {
  try {
    const count = await Plan.countDocuments({ userId: req.user.id });
    res.json({ count });
  } catch (error) {
    console.error('Erreur récupération nombre de plans:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
