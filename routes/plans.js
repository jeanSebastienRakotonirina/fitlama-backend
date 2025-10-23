import express from 'express';
import { Plan } from '../models/Plan.js';
import authMiddleware from '../middleware/auth.js';
import { generateFitnessPlan, generateNutritionPlan } from '../services/planGenerator.js';
import mongoose from 'mongoose';

const router = express.Router();

// Get a specific plan by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    console.log('GET /api/plans/:id - Request received', {
      planId: req.params.id,
      userId: req.user.id,
      role: req.user.role
    });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error('GET /api/plans/:id - Invalid plan ID', { planId: req.params.id });
      return res.status(400).json({ message: 'ID de plan invalide' });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      console.error('GET /api/plans/:id - Plan not found', { planId: req.params.id });
      return res.status(404).json({ message: 'Plan non trouvé' });
    }
    // RBAC: Users can only access their own plans or public plans; admins/superadmins can access all
    if (req.user.role === 'user' && plan.userId.toString() !== req.user.id && !plan.isPublic) {
      console.error('GET /api/plans/:id - Access denied', { userId: req.user.id, planUserId: plan.userId });
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    console.log('GET /api/plans/:id - Plan fetched', { planId: plan._id });
    res.json({
      ...plan.toObject(),
      createdAt: plan.createdAt.toISOString()
    });
  } catch (error) {
    console.error('GET /api/plans/:id - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Get all plans (filtered by userId for non-admins)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    console.log('GET /api/plans/all - Request received', {
      userId: req.user.id,
      role: req.user.role,
      query: req.query
    });
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      console.error('GET /api/plans/all - Invalid pagination parameters', { page, limit });
      return res.status(400).json({ message: 'Paramètres de pagination invalides' });
    }

    const query = req.user.role === 'user' ? { userId: req.user.id } : {};
    const plans = await Plan.find(query)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('type profile goal createdAt isPublic userId');
    const total = await Plan.countDocuments(query);

    console.log('GET /api/plans/all - Plans fetched', { total, plansCount: plans.length });
    res.json({
      plans: plans.map(plan => ({
        ...plan.toObject(),
        createdAt: plan.createdAt.toISOString()
      })),
      total
    });
  } catch (error) {
    console.error('GET /api/plans/all - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Get plan count for the authenticated user
router.get('/count', authMiddleware, async (req, res) => {
  try {
    console.log('GET /api/plans/count - Request received', { userId: req.user.id });
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      console.error('GET /api/plans/count - Invalid user ID', { userId: req.user.id });
      return res.status(400).json({ message: 'ID utilisateur invalide' });
    }
    const count = await Plan.countDocuments({ userId: new mongoose.Types.ObjectId(req.user.id) });
    console.log('GET /api/plans/count - Plan count', { count });
    res.json({ count });
  } catch (error) {
    console.error('GET /api/plans/count - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Generate a new plan
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    console.log('POST /api/plans/generate - Request received', { userId: req.user.id, type: req.body.type });
    const { type, profile, isPublic } = req.body;

    if (!type || !profile) {
      console.error('POST /api/plans/generate - Missing type or profile');
      return res.status(400).json({ message: 'Type et profil requis' });
    }

    // Validate subscription for public plans
    if (isPublic && req.user.subscription.plan !== 'premium') {
      console.error('POST /api/plans/generate - Public plans require Premium', { userId: req.user.id });
      return res.status(403).json({ message: 'Plan Premium requis pour rendre le plan public' });
    }

    // Generate plan based on type
    let planData;
    if (type === 'fitness') {
      planData = generateFitnessPlan(profile);
    } else if (type === 'nutrition') {
      planData = generateNutritionPlan(profile);
    } else {
      console.error('POST /api/plans/generate - Invalid plan type', { type });
      return res.status(400).json({ message: 'Type de plan invalide' });
    }

    const plan = new Plan({
      type,
      profile,
      jours: planData.jours,
      isPublic,
      userId: req.user.id
    });
    await plan.save();
    console.log('POST /api/plans/generate - Plan created', { planId: plan._id });
    res.json({ planId: plan._id });
  } catch (error) {
    console.error('POST /api/plans/generate - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Delete a plan (admin/superadmin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    console.log('DELETE /api/plans/:id - Request received', { planId: req.params.id, userId: req.user.id, role: req.user.role });
    if (!['admin', 'superadmin'].includes(req.user.role)) {
      console.error('DELETE /api/plans/:id - Access denied', { userId: req.user.id, role: req.user.role });
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error('DELETE /api/plans/:id - Invalid plan ID', { planId: req.params.id });
      return res.status(400).json({ message: 'ID de plan invalide' });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      console.error('DELETE /api/plans/:id - Plan not found', { planId: req.params.id });
      return res.status(404).json({ message: 'Plan non trouvé' });
    }
    await Plan.deleteOne({ _id: req.params.id });
    console.log('DELETE /api/plans/:id - Plan deleted', { planId: req.params.id });
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