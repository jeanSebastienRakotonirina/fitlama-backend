const express = require('express');
const authMiddleware = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const paypal = require('@paypal/checkout-server-sdk');
const { addDays, addMonths, addYears } = require('date-fns'); // npm install date-fns

const router = express.Router();

// PayPal Client
function paypalClient() {
  const environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );
  return new paypal.core.PayPalHttpClient(environment);
}

// GET /api/subscription/status - Vérifie si l'utilisateur a un abonnement actif
router.get('/status', authMiddleware(), async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user.id })
      .sort({ startDate: -1 })
      .lean();

    const subscribed = subscription && new Date(subscription.endDate) > new Date();

    res.json({ subscribed });
  } catch (err) {
    console.error('Erreur récupération statut abonnement:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// POST /api/subscription/capture-donate - Capture un paiement PayPal et active l'abonnement
router.post('/capture-donate', authMiddleware(), async (req, res) => {
  const { txn_id, amount, period } = req.body;

  // Validation des champs
  if (!txn_id || !amount || !period) {
    return res.status(400).json({
      message: 'Champs requis manquants : txn_id, amount et period sont obligatoires'
    });
  }

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      message: 'Montant invalide : doit être un nombre positif'
    });
  }

  const validPeriods = ['week', 'month', 'year'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({
      message: `Période invalide. Valeurs acceptées : ${validPeriods.join(', ')}`
    });
  }

  try {
    // Vérifie que la commande PayPal est bien COMPLETED
    const request = new paypal.orders.OrdersGetRequest(txn_id);
    const response = await paypalClient().execute(request);

    if (response.result.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Paiement non finalisé (statut ≠ COMPLETED)' });
    }

    // Calcul de la date de fin selon la période
    let endDate;
    const now = new Date();

    switch (period) {
      case 'week':
        endDate = addDays(now, 7);
        break;
      case 'month':
        endDate = addMonths(now, 1);
        break;
      case 'year':
        endDate = addYears(now, 1);
        break;
      default:
        return res.status(400).json({ message: 'Période non gérée' });
    }

    // Sauvegarde de l'abonnement
    const subscription = new Subscription({
      userId: req.user.id,
      amount: parseFloat(amount),
      period,
      startDate: now,
      endDate,
      orderID: txn_id,
      status: 'active'
    });

    await subscription.save();

    console.log(`Abonnement ${period} activé pour user ${req.user.id} - Order: ${txn_id}`);
    res.json({ status: 'success', message: 'Abonnement activé avec succès' });
  } catch (err) {
    console.error('Erreur capture don PayPal:', err.response?.data || err.message);
    res.status(500).json({
      message: 'Erreur lors de la validation du paiement PayPal',
      error: err.message
    });
  }
});

module.exports = router;