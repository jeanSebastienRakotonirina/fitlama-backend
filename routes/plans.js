import express from 'express';
import { Plan } from '../models/Plan.js';
import auth from '../middleware/auth.js';
import axios from 'axios';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';

const router = express.Router();

router.post('/generate', auth, async (req, res) => {
  console.log('POST /api/plans/generate - Request received', {
    userId: req.user.id,
    userRole: req.user.role,
    timestamp: new Date().toISOString(),
    body: req.body
  });
  try {
    console.log('POST /api/plans/generate - Fetching user data for ID:', req.user.id);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('POST /api/plans/generate - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    console.log('POST /api/plans/generate - User found:', { id: user._id, role: user.role });

    if (!['admin', 'superadmin'].includes(user.role)) {
      console.error('POST /api/plans/generate - Access denied: User role is', user.role);
      return res.status(403).json({ message: 'Accès réservé aux admins et superadmins' });
    }

    console.log('POST /api/plans/generate - Checking subscription and plan count');
    const subscription = await Subscription.findOne({ userId: req.user.id });
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    console.log('POST /api/plans/generate - Subscription:', subscription || 'None');
    console.log('POST /api/plans/generate - Plan count:', planCount);

    if (planCount === 0) {
      console.log('POST /api/plans/generate - First plan free, no subscription check required');
    } else if (user.role !== 'superadmin' && planCount >= 3 && (!subscription || subscription.plan !== 'mensuel' || !subscription.isActive)) {
      console.error('POST /api/plans/generate - Plan limit reached, subscription required');
      return res.status(403).json({ message: 'Abonnement mensuel requis pour générer plus de 3 plans' });
    }

    const { type, profile, isPublic } = req.body;
    console.log('POST /api/plans/generate - Parsed request body:', { type, profile, isPublic });
    if (!['fitness', 'nutrition'].includes(type)) {
      console.error('POST /api/plans/generate - Invalid plan type:', type);
      return res.status(400).json({ message: 'Type de plan invalide (doit être "fitness" ou "nutrition")' });
    }
    if (!profile || !profile.age || !profile.taille || !profile.poids || !profile.goal) {
      console.error('POST /api/plans/generate - Missing required profile fields:', profile);
      return res.status(400).json({ message: 'Champs de profil requis manquants (âge, taille, poids, objectif)' });
    }
    if (type === 'fitness' && !profile.level) {
      console.error('POST /api/plans/generate - Missing level for fitness plan');
      return res.status(400).json({ message: 'Niveau requis pour les plans fitness' });
    }
    if (type === 'nutrition' && !profile.dietary_preference) {
      console.error('POST /api/plans/generate - Missing dietary preference for nutrition plan');
      return res.status(400).json({ message: 'Préférence alimentaire requise pour les plans nutrition' });
    }

    console.log('POST /api/plans/generate - Generating prompt for OpenRouter API, type:', type);
    const prompt = `Générer un plan de ${type} pour une personne de ${profile.age} ans, ${profile.taille} cm, ${profile.poids} kg, objectif: ${profile.goal}, ${type === 'nutrition' ? 'préférence alimentaire: ' + profile.dietary_preference : 'niveau: ' + profile.level}. Retourner une réponse JSON avec une structure contenant un tableau 'jours' où chaque jour a des champs ${type === 'nutrition' ? "'repas' (tableau d'objets avec 'type' et 'description')" : "'exercices' (tableau d'objets avec 'nom', 'series', 'repetitions')"}.`;
    console.log('POST /api/plans/generate - Prompt:', prompt);

    console.log('POST /api/plans/generate - Sending request to OpenRouter API');
    const response = await axios.post('https://openrouter.ai/api/v1/completions', {
      model: process.env.OPENROUTER_MODEL || 'gpt-3.5-turbo',
      prompt,
      response_format: { type: 'json_object' }
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
    });
    console.log('POST /api/plans/generate - OpenRouter API response:', {
      status: response.status,
      choices: response.data.choices?.length || 0
    });

    let planData;
    try {
      planData = typeof response.data.choices[0].text === 'string' ? JSON.parse(response.data.choices[0].text) : response.data.choices[0].text;
      console.log('POST /api/plans/generate - Parsed plan data:', planData);
    } catch (parseError) {
      console.error('POST /api/plans/generate - Error parsing OpenRouter response:', {
        error: parseError.message,
        rawResponse: response.data.choices[0].text
      });
      return res.status(500).json({ message: 'Erreur lors du parsing de la réponse AI' });
    }

    if (!planData.jours || !Array.isArray(planData.jours)) {
      console.error('POST /api/plans/generate - Invalid plan structure:', planData);
      return res.status(500).json({ message: 'Structure du plan invalide' });
    }

    for (const jour of planData.jours) {
      if (type === 'fitness' && (!jour.exercices || !Array.isArray(jour.exercices))) {
        console.error('POST /api/plans/generate - Invalid fitness plan structure: Missing exercices array');
        return res.status(500).json({ message: 'Les plans fitness doivent contenir un tableau exercices' });
      }
      if (type === 'nutrition' && (!jour.repas || !Array.isArray(jour.repas))) {
        console.error('POST /api/plans/generate - Invalid nutrition plan structure: Missing repas array');
        return res.status(500).json({ message: 'Les plans nutrition doivent contenir un tableau repas' });
      }
    }

    console.log('POST /api/plans/generate - Creating new plan in database');
    const plan = new Plan({
      userId: req.user.id,
      type,
      profile,
      plan: planData,
      isPublic
    });

    await plan.save();
    console.log('POST /api/plans/generate - Plan created successfully:', {
      id: plan._id,
      type: plan.type,
      userId: plan.userId,
      isPublic: plan.isPublic,
      createdAt: plan.createdAt
    });
    res.status(201).json(plan);
  } catch (error) {
    console.error('POST /api/plans/generate - Error:', {
      message: error.message,
      stack: error.stack,
      responseData: error.response?.data
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/', auth, async (req, res) => {
  console.log('GET /api/plans - Request received', {
    userId: req.user.id,
    userRole: req.user.role,
    timestamp: new Date().toISOString()
  });
  try {
    console.log('GET /api/plans - Fetching user data for ID:', req.user.id);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('GET /api/plans - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    console.log('GET /api/plans - User found:', { id: user._id, role: user.role });

    if (!['admin', 'superadmin'].includes(user.role)) {
      console.error('GET /api/plans - Access denied: User role is', user.role);
      return res.status(403).json({ message: 'Accès réservé aux admins et superadmins' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 2;
    const skip = (page - 1) * limit;
    console.log('GET /api/plans - Query parameters:', { page, limit, skip });

    console.log('GET /api/plans - Fetching plans for user:', req.user.id);
    const plans = await Plan.find({ userId: req.user.id })
      .skip(skip)
      .limit(limit);
    const total = await Plan.countDocuments({ userId: req.user.id });
    console.log('GET /api/plans - Plans fetched:', {
      count: plans.length,
      total,
      types: plans.map(p => p.type)
    });

    res.json({ plans, total });
  } catch (error) {
    console.error('GET /api/plans - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/all', auth, async (req, res) => {
  console.log('GET /api/plans/all - Request received', {
    userId: req.user.id,
    userRole: req.user.role,
    timestamp: new Date().toISOString()
  });
  try {
    console.log('GET /api/plans/all - Fetching user data for ID:', req.user.id);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('GET /api/plans/all - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    console.log('GET /api/plans/all - User found:', { id: user._id, role: user.role });

    if (user.role !== 'superadmin') {
      console.error('GET /api/plans/all - Access denied: User is not superadmin');
      return res.status(403).json({ message: 'Accès réservé aux superadmins' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 2;
    const skip = (page - 1) * limit;
    console.log('GET /api/plans/all - Query parameters:', { page, limit, skip });

    console.log('GET /api/plans/all - Fetching all plans');
    const plans = await Plan.find()
      .skip(skip)
      .limit(limit);
    const total = await Plan.countDocuments();
    console.log('GET /api/plans/all - Plans fetched:', {
      count: plans.length,
      total,
      types: plans.map(p => p.type)
    });

    res.json({ plans, total });
  } catch (error) {
    console.error('GET /api/plans/all - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/count', auth, async (req, res) => {
  console.log('GET /api/plans/count - Request received', {
    userId: req.user.id,
    userRole: req.user.role,
    timestamp: new Date().toISOString()
  });
  try {
    console.log('GET /api/plans/count - Fetching user data for ID:', req.user.id);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('GET /api/plans/count - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    console.log('GET /api/plans/count - User found:', { id: user._id, role: user.role });

    if (!['admin', 'superadmin'].includes(user.role)) {
      console.error('GET /api/plans/count - Access denied: User role is', user.role);
      return res.status(403).json({ message: 'Accès réservé aux admins et superadmins' });
    }

    console.log('GET /api/plans/count - Counting plans for user:', req.user.id);
    const count = await Plan.countDocuments({ userId: req.user.id });
    console.log('GET /api/plans/count - Plan count fetched:', count);

    res.json({ count });
  } catch (error) {
    console.error('GET /api/plans/count - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  console.log('DELETE /api/plans/:id - Request received', {
    planId: req.params.id,
    userId: req.user.id,
    userRole: req.user.role,
    timestamp: new Date().toISOString()
  });
  try {
    console.log('DELETE /api/plans/:id - Fetching user data for ID:', req.user.id);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('DELETE /api/plans/:id - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    console.log('DELETE /api/plans/:id - User found:', { id: user._id, role: user.role });

    if (!['admin', 'superadmin'].includes(user.role)) {
      console.error('DELETE /api/plans/:id - Access denied: User role is', user.role);
      return res.status(403).json({ message: 'Accès réservé aux admins et superadmins' });
    }

    console.log('DELETE /api/plans/:id - Fetching plan data for ID:', req.params.id);
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      console.error('DELETE /api/plans/:id - Plan not found:', req.params.id);
      return res.status(404).json({ message: 'Plan non trouvé' });
    }
    console.log('DELETE /api/plans/:id - Plan found:', { id: plan._id, type: plantype });

    if (plan.userId.toString() !== req.user.id && user.role !== 'superadmin') {
      console.error('DELETE /api/plans/:id - Access denied: User not authorized to delete this plan');
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    console.log('DELETE /api/plans/:id - Deleting plan');
    await plan.deleteOne();
    console.log('DELETE /api/plans/:id - Plan deleted successfully:', req.params.id);
    res.json({ message: 'Plan supprimé' });
  } catch (error) {
    console.error('DELETE /api/plans/:id - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;