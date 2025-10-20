const express = require('express');
const authMiddleware = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const paypal = require('@paypal/checkout-server-sdk');

const router = express.Router();

function paypalClient() {
  const environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );
  return new paypal.core.PayPalHttpClient(environment);
}

router.get('/status', authMiddleware(), async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user.id }).sort({ startDate: -1 });
    const subscribed = subscription && subscription.endDate > new Date();
    res.json({ subscribed });
  } catch (err) {
    console.error('Erreur lors de la récupération du statut de l\'abonnement:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

router.get('/check-limit', authMiddleware(), async (req, res) => {
  try {
    const freePlanCount = await Subscription.countDocuments({ userId: req.user.id, amount: 0 });
    res.json({ hasReachedLimit: freePlanCount >= 3 });
  } catch (err) {
    console.error('Erreur lors de la vérification de la limite de plans gratuits:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

router.post('/activate-free', authMiddleware(), async (req, res) => {
  const { period } = req.body;

  if (!period) {
    return res.status(400).json({ message: 'Champ requis manquant : period est obligatoire' });
  }
  const validPeriods = ['month', 'quarter', 'year'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({ message: `Période invalide : doit être l'une des suivantes : ${validPeriods.join(', ')}` });
  }

  try {
    const freePlanCount = await Subscription.countDocuments({ userId: req.user.id, amount: 0 });
    if (freePlanCount >= 3) {
      return res.status(400).json({ message: 'Vous avez déjà 3 plans. Abonnez-vous pour générer des plans supplémentaires.' });
    }

    let endDate;
    switch (period) {
      case 'month':
        endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        break;
    }
    const subscription = new Subscription({
      userId: req.user.id,
      amount: 0,
      period,
      endDate,
      orderID: `FREE_${Date.now()}`
    });
    await subscription.save();
    res.json({ status: 'success' });
  } catch (err) {
    console.error('Erreur lors de l\'activation du plan gratuit:', err);
    res.status(500).json({ message: 'Erreur activation plan gratuit', error: err.message });
  }
});

router.post('/capture-donate', authMiddleware(), async (req, res) => {
  const { txn_id, amount, period } = req.body;

  if (!txn_id || !amount || !period) {
    return res.status(400).json({ message: 'Champs requis manquants : txn_id, amount et period sont obligatoires' });
  }
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Montant invalide : doit être un nombre positif' });
  }
  const validPeriods = ['month', 'quarter', 'year'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({ message: `Période invalide : doit être l'une des suivantes : ${validPeriods.join(', ')}` });
  }

  try {
    const request = new paypal.orders.OrdersGetRequest(txn_id);
    const response = await paypalClient().execute(request);
    if (response.result.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Don non validé' });
    }

    let endDate;
    switch (period) {
      case 'month':
        endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        break;
    }
    const subscription = new Subscription({
      userId: req.user.id,
      amount,
      period,
      endDate,
      orderID: txn_id
    });
    await subscription.save();
    res.json({ status: 'success' });
  } catch (err) {
    console.error('Erreur lors de la capture du don PayPal:', err);
    res.status(500).json({ message: 'Erreur capture don PayPal', error: err.message });
  }
});

module.exports = router;