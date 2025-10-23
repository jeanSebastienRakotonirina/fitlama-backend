import express from 'express';
import auth from '../middleware/auth.js';
import paypal from 'paypal-rest-sdk';

const router = express.Router();

paypal.configure({
  mode: 'sandbox',
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
});

router.post('/create-order', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    const planId = plan === 'basic' ? process.env.PPNUTTON : process.env.PPNUTTON;
    const create_subscription = {
      plan_id: planId,
      custom_id: req.user.id
    };
    paypal.billing.subscriptions.create(create_subscription, (error, subscription) => {
      if (error) {
        console.error('Erreur création commande PayPal:', error);
        return res.status(500).json({ message: 'Erreur serveur' });
      }
      const approvalLink = subscription.links.find(link => link.rel === 'approve').href;
      res.json({ id: subscription.id, approvalLink });
    });
  } catch (error) {
    console.error('Erreur création commande PayPal:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/capture-order', auth, async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    paypal.billing.subscriptions.get(subscriptionId, (error, subscription) => {
      if (error) {
        console.error('Erreur capture commande PayPal:', error);
        return res.status(500).json({ message: 'Erreur serveur' });
      }
      res.json(subscription);
    });
  } catch (error) {
    console.error('Erreur capture commande PayPal:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;