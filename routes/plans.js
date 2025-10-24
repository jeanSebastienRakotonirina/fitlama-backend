import express from 'express';
import { Plan } from '../models/Plan.js';
import { User } from '../models/User.js';
import auth from '../middleware/auth.js';
import { generateFitnessPlan, generateNutritionPlan } from '../services/planGenerator.js';

const router = express.Router();

router.get('/all', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    let query = {};
    if (user.role === 'user') {
      query = { userId: req.user.id };
    }
    const plans = await Plan.find(query).skip(skip).limit(limit);
    const total = await Plan.countDocuments(query);
    res.json({ plans, total });
  } catch (error) {
    console.error('Erreur récupération plans:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/count', auth, async (req, res) => {
  try {
    const count = await Plan.countDocuments({ userId: req.user.id });
    res.json({ count });
  } catch (error) {
    console.error('Erreur comptage plans:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Plan non trouvé' });
    }
    if (plan.userId.toString() !== req.user.id && !plan.isPublic && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Accès interdit' });
    }
    res.json(plan);
  } catch (error) {
    console.error('Erreur récupération plan:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/generate', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    const planCount = await Plan.countDocuments({ userId: req.user.id });
    if (planCount >= 3 && !user.subscription.isActive && user.role === 'user') {
      return res.status(403).json({ message: 'Limite de plans atteinte. Abonnez-vous pour continuer.' });
    }
    const { type, profile, isPublic } = req.body;
    if (!type || !profile || isPublic === undefined) {
      return res.status(400).json({ message: 'Type, profil et visibilité requis' });
    }
    if (type !== 'fitness' && type !== 'nutrition') {
      return res.status(400).json({ message: 'Type de plan invalide' });
    }
    if (isPublic && user.subscription.plan !== 'premium') {
      return res.status(403).json({ message: 'Plan public réservé aux abonnés premium' });
    }
    const jours = type === 'fitness' ? generateFitnessPlan(profile) : generateNutritionPlan(profile);
    const plan = new Plan({
      userId: req.user.id,
      type,
      profile,
      jours,
      isPublic
    });
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    console.error('Erreur génération plan:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Plan non trouvé' });
    }
    if (plan.userId.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Accès interdit' });
    }
    await Plan.deleteOne({ _id: req.params.id });
    res.json({ message: 'Plan supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression plan:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;