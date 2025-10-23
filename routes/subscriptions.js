import express from 'express';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/confirm', auth, async (req, res) => {
  try {
    console.log('POST /api/subscriptions/confirm - Request received', {
      userId: req.user.id,
      subscriptionId: req.body.subscriptionId,
      plan: req.body.plan
    });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('POST /api/subscriptions/confirm - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    const { subscriptionId, plan } = req.body;
    if (!['basic', 'premium'].includes(plan)) {
      console.error('POST /api/subscriptions/confirm - Invalid plan:', plan);
      return res.status(400).json({ message: 'Plan invalide' });
    }
    // Verify PayPal subscription (simplified; in production, verify with PayPal API)
    let subscription = await Subscription.findOne({ userId: req.user.id });
    if (!subscription) {
      subscription = new Subscription({
        userId: req.user.id,
        subscriptionId,
        plan,
        isActive: true
      });
    } else {
      subscription.subscriptionId = subscriptionId;
      subscription.plan = plan;
      subscription.isActive = true;
    }
    await subscription.save();
    user.subscription = { plan, isActive: true };
    await user.save();
    console.log('POST /api/subscriptions/confirm - Subscription confirmed', {
      userId: req.user.id,
      plan,
      subscriptionId
    });
    res.json({ message: 'Abonnement activé avec succès' });
  } catch (error) {
    console.error('POST /api/subscriptions/confirm - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;