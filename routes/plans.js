import express from 'express';
import { Plan } from '../models/Plan.js';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import auth from '../middleware/auth.js';
import axios from 'axios';

const router = express.Router();

router.post('/generate', auth, async (req, res) => {
  try {
    console.log('POST /api/plans/generate - Request received', { userId: req.user.id, body: req.body });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('POST /api/plans/generate - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (!['admin', 'superadmin'].includes(user.role)) {
      console.error('POST /api/plans/generate - Access denied:', { role: user.role });
      return res.status(403).json({ message: 'Accès réservé aux admins et superadmins' });
    }
    const subscription = await Subscription.findOne({ userId: req.user.id });
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    if (planCount >= 3 && (!subscription || subscription.plan !== 'premium' || !subscription.isActive)) {
      console.warn('POST /api/plans/generate - Plan limit reached', { planCount, subscription: subscription?.plan });
      return res.status(403).json({ message: 'Abonnement premium requis pour générer plus de 3 plans' });
    }
    const { type, profile, isPublic } = req.body;
    if (!['fitness', 'nutrition'].includes(type)) {
      console.error('POST /api/plans/generate - Invalid plan type:', type);
      return res.status(400).json({ message: 'Type de plan invalide' });
    }
    if (!profile || !profile.age || !profile.taille || !profile.poids || !profile.goal) {
      console.error('POST /api/plans/generate - Missing required profile fields', { profile });
      return res.status(400).json({ message: 'Champs de profil requis manquants' });
    }
    if (type === 'fitness' && !profile.level) {
      console.error('POST /api/plans/generate - Missing level for fitness plan');
      return res.status(400).json({ message: 'Niveau requis pour les plans fitness' });
    }
    if (type === 'nutrition' && !profile.dietary_preference) {
      console.error('POST /api/plans/generate - Missing dietary preference for nutrition plan');
      return res.status(400).json({ message: 'Préférence alimentaire requise pour les plans nutrition' });
    }
    if (isPublic && (!subscription || subscription.plan !== 'premium' || !subscription.isActive)) {
      console.warn('POST /api/plans/generate - Public plan requires premium subscription');
      return res.status(403).json({ message: 'Abonnement premium requis pour rendre les plans publics' });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('POST /api/plans/generate - Missing OPENROUTER_API_KEY');
      return res.status(500).json({ message: 'Configuration serveur manquante' });
    }
    const sanitizedProfile = {
      age: Number(profile.age) || 0,
      taille: Number(profile.taille) || 0,
      poids: Number(profile.poids) || 0,
      goal: String(profile.goal || '').slice(0, 100),
      level: type === 'fitness' ? String(profile.level || '').slice(0, 50) : undefined,
      dietary_preference: type === 'nutrition' ? String(profile.dietary_preference || '').slice(0, 50) : undefined
    };
    const prompt = `Générer un plan de ${type} pour une personne de ${sanitizedProfile.age} ans, ${sanitizedProfile.taille} cm, ${sanitizedProfile.poids} kg, objectif: ${sanitizedProfile.goal}, ${type === 'nutrition' ? 'préférence alimentaire: ' + sanitizedProfile.dietary_preference : 'niveau: ' + sanitizedProfile.level}. Retourner une réponse JSON avec une structure contenant un tableau 'jours' où chaque jour a des champs ${type === 'nutrition' ? "'repas' (tableau d'objets avec 'type' et 'description')" : "'exercices' (tableau d'objets avec 'nom', 'series', 'repetitions')"}. Ne pas inclure de champ 'jour' dans les objets du tableau 'jours'. La réponse doit être une chaîne JSON valide sans formatage Markdown (pas de \`\`\`json ou autres balises).`;
    console.log('POST /api/plans/generate - Sending OpenRouter request', { prompt, model: process.env.OPENROUTER_MODEL });
    const response = await axios.post(
      'https://openrouter.ai/api/v1/completions',
      {
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
        prompt
      },
      {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
      }
    );
    let planData;
    try {
      let rawText = response.data.choices[0].text;
      console.log('POST /api/plans/generate - Raw response text:', rawText);
      rawText = rawText.replace(/```json\n|```/g, '').trim();
      planData = JSON.parse(rawText);
    } catch (parseError) {
      console.error('POST /api/plans/generate - Failed to parse OpenRouter response:', {
        message: parseError.message,
        rawText: response.data.choices[0].text
      });
      return res.status(500).json({ message: 'Erreur lors du traitement de la réponse du modèle' });
    }
    let normalizedJours;
    if (planData.jours && Array.isArray(planData.jours)) {
      normalizedJours = planData.jours.map(day => ({
        exercices: day.exercices || day.repas || [],
        ...(day.repas && { repas: day.repas })
      }));
    } else {
      console.error('POST /api/plans/generate - Invalid planData structure:', JSON.stringify(planData, null, 2));
      return res.status(400).json({ message: 'Structure de plan invalide' });
    }
    const isValidJours = normalizedJours.every(day => 
      (type === 'fitness' && Array.isArray(day.exercices) && day.exercices.every(ex => ex.nom && ex.series && ex.repetitions)) ||
      (type === 'nutrition' && Array.isArray(day.repas) && day.repas.every(meal => meal.type && meal.description))
    );
    if (!isValidJours) {
      console.error('POST /api/plans/generate - Invalid exercises or meals in normalized planData:', JSON.stringify(normalizedJours, null, 2));
      return res.status(400).json({ message: 'Structure de plan invalide: exercices ou repas mal formés' });
    }
    const plan = new Plan({
      userId: req.user.id,
      type,
      profile: sanitizedProfile,
      jours: normalizedJours,
      isPublic: isPublic || false
    });
    await plan.save();
    console.log('POST /api/plans/generate - Plan saved successfully', { planId: plan._id });
    res.status(201).json(plan);
  } catch (error) {
    console.error('POST /api/plans/generate - Error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(error.message.includes('modération') || error.message.includes('provider') || error.message.includes('Structure de plan invalide') || error.message.includes('JSON schema') ? 400 : 500).json({ message: error.message || 'Erreur serveur' });
  }
});

router.get('/count', auth, async (req, res) => {
  try {
    console.log('GET /api/plans/count - Request received', { userId: req.user.id });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('GET /api/plans/count - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (!['admin', 'superadmin'].includes(user.role)) {
      console.error('GET /api/plans/count - Access denied:', { role: user.role });
      return res.status(403).json({ message: 'Accès réservé aux admins et superadmins' });
    }
    const count = await Plan.countDocuments({ userId: req.user.id });
    console.log('GET /api/plans/count - Plan count:', { count });
    res.json({ count });
  } catch (error) {
    console.error('GET /api/plans/count - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/all', auth, async (req, res) => {
  try {
    console.log('GET /api/plans/all - Request received', { userId: req.user.id });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('GET /api/plans/all - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (!['admin', 'superadmin'].includes(user.role)) {
      console.error('GET /api/plans/all - Access denied:', { role: user.role });
      return res.status(403).json({ message: 'Accès réservé aux admins et superadmins' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    console.log('GET /api/plans/all - Query parameters:', { page, limit, skip });
    const plans = await Plan.find({ $or: [{ userId: req.user.id }, { isPublic: true }] })
      .skip(skip)
      .limit(limit);
    const total = await Plan.countDocuments({ $or: [{ userId: req.user.id }, { isPublic: true }] });
    console.log('GET /api/plans/all - Plans fetched:', { count: plans.length, total });
    res.json({ plans, total });
  } catch (error) {
    console.error('GET /api/plans/all - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    console.log('GET /api/plans/:id - Request received', { userId: req.user.id, planId: req.params.id });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('GET /api/plans/:id - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      console.error('GET /api/plans/:id - Plan not found:', req.params.id);
      return res.status(404).json({ message: 'Plan non trouvé' });
    }
    if (!['admin', 'superadmin'].includes(user.role) && plan.userId.toString() !== req.user.id && !plan.isPublic) {
      console.error('GET /api/plans/:id - Access denied:', { role: user.role, planUserId: plan.userId });
      return res.status(403).json({ message: 'Accès réservé aux admins, superadmins ou au propriétaire du plan' });
    }
    console.log('GET /api/plans/:id - Plan fetched successfully', { planId: plan._id });
    res.json(plan);
  } catch (error) {
    console.error('GET /api/plans/:id - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    console.log('PUT /api/plans/:id - Request received', { userId: req.user.id, planId: req.params.id, body: req.body });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('PUT /api/plans/:id - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (!['admin', 'superadmin'].includes(user.role)) {
      console.error('PUT /api/plans/:id - Access denied:', { role: user.role });
      return res.status(403).json({ message: 'Accès réservé aux admins et superadmins' });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      console.error('PUT /api/plans/:id - Plan not found:', req.params.id);
      return res.status(404).json({ message: 'Plan non trouvé' });
    }
    const { type, profile, isPublic } = req.body;
    if (!['fitness', 'nutrition'].includes(type)) {
      return res.status(400).json({ message: 'Type de plan invalide' });
    }
    if (!profile || !profile.age || !profile.taille || !profile.poids || !profile.goal) {
      return res.status(400).json({ message: 'Champs de profil requis manquants' });
    }
    if (type === 'fitness' && !profile.level) {
      return res.status(400).json({ message: 'Niveau requis pour les plans fitness' });
    }
    if (type === 'nutrition' && !profile.dietary_preference) {
      return res.status(400).json({ message: 'Préférence alimentaire requise pour les plans nutrition' });
    }
    if (isPublic && (!user.subscription || user.subscription.plan !== 'premium' || !user.subscription.isActive)) {
      return res.status(403).json({ message: 'Abonnement premium requis pour rendre les plans publics' });
    }
    plan.type = type;
    plan.profile = {
      age: Number(profile.age),
      taille: Number(profile.taille),
      poids: Number(profile.poids),
      goal: String(profile.goal).slice(0, 100),
      level: type === 'fitness' ? String(profile.level).slice(0, 50) : undefined,
      dietary_preference: type === 'nutrition' ? String(profile.dietary_preference).slice(0, 50) : undefined
    };
    plan.isPublic = isPublic || false;
    await plan.save();
    console.log('PUT /api/plans/:id - Plan updated successfully', { planId: plan._id });
    res.json(plan);
  } catch (error) {
    console.error('PUT /api/plans/:id - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    console.log('DELETE /api/plans/:id - Request received', { userId: req.user.id, planId: req.params.id });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('DELETE /api/plans/:id - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (!['admin', 'superadmin'].includes(user.role)) {
      console.error('DELETE /api/plans/:id - Access denied:', { role: user.role });
      return res.status(403).json({ message: 'Accès réservé aux admins et superadmins' });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      console.error('DELETE /api/plans/:id - Plan not found:', req.params.id);
      return res.status(404).json({ message: 'Plan non trouvé' });
    }
    await Plan.deleteOne({ _id: req.params.id });
    console.log('DELETE /api/plans/:id - Plan deleted successfully', { planId: req.params.id });
    res.json({ message: 'Plan supprimé avec succès' });
  } catch (error) {
    console.error('DELETE /api/plans/:id - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;