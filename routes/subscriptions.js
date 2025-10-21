const express = require('express');
const router = express.Router();
const axios = require('axios');
const Subscription = require('../models/Subscription');
const auth = require('../middleware/auth');

router.post('/webhook', async (req, res) => {
  try {
    const { event_type, resource } = req.body;

    if (event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const subscriptionId = resource.id;
      const plan = resource.plan_id === 'YOUR_BASIC_BUTTON_ID' ? 'basic' : 'premium';
      const userId = resource.custom_id;

      let subscription = await Subscription.findOne({ subscriptionId });
      if (!subscription) {
        subscription = new Subscription({
          userId,
          subscriptionId,
          plan,
          isActive: true
        });
      } else {
        subscription.isActive = true;
        subscription.plan = plan;
      }
      await subscription.save();
      res.status(200).send('Webhook processed');
    } else if (event_type === 'BILLING.SUBSCRIPTION.CANCELLED') {
      const subscriptionId = resource.id;
      const subscription = await Subscription.findOne({ subscriptionId });
      if (subscription) {
        subscription.isActive = false;
        await subscription.save();
      }
      res.status(200).send('Webhook processed');
    } else {
      res.status(400).send('Event type not handled');
    }
  } catch (error) {
    console.error('Erreur webhook:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user.id });
    if (!subscription) {
      return res.json({ plan: 'none', isActive: false });
    }
    res.json({ plan: subscription.plan, isActive: subscription.isActive });
  } catch (error) {
    console.error('Erreur récupération abonnement:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
