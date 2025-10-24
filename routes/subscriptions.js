import express from 'express';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/confirm', async (req, res) => {
  try {
    console.log('POST /api/subscriptions/confirm - Request received', req.body);
    const { custom, payment_status, item_name } = req.body;

    if (!custom || !payment_status || !item_name) {
      console.error('POST /api/subscriptions/confirm - Missing required fields', req.body);
      return res.status(400).json({ message: 'Données de paiement incomplètes' });
    }

    let plan;
    if (item_name.includes('Weekly')) {
      plan = 'basic';
    } else if (item_name.includes('Monthly')) {
      plan = 'premium';
    } else {
      console.error('POST /api/subscriptions/confirm - Invalid plan', { item_name });
      return res.status(400).json({ message: 'Plan invalide' });
    }

    if (payment_status !== 'Completed') {
      console.error('POST /api/subscriptions/confirm - Payment not completed', { payment_status });
      return res.status(400).json({ message: 'Paiement non complété' });
    }

    const user = await User.findById(custom);
    if (!user) {
      console.error('POST /api/subscriptions/confirm - User not found:', custom);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    let subscription = await Subscription.findOne({ userId: custom });
    if (!subscription) {
      subscription = new Subscription({
        userId: custom,
        subscriptionId: req.body.txn_id || 'manual-' + Date.now(),
        plan,
        isActive: true
      });
    } else {
      subscription.subscriptionId = req.body.txn_id || 'manual-' + Date.now();
      subscription.plan = plan;
      subscription.isActive = true;
    }
    await subscription.save();

    user.subscription = { plan, isActive: true };
    await user.save();

    console.log('POST /api/subscriptions/confirm - Subscription confirmed', {
      userId: custom,
      plan,
      subscriptionId: subscription.subscriptionId
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