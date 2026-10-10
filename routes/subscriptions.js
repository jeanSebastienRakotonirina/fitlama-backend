const express = require('express');
const authMiddleware = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const paypal = require('@paypal/checkout-server-sdk');
const { addDays, addMonths, addYears } = require('date-fns');

const router = express.Router();

/**
 * Initialise et retourne un client PayPal configuré en mode sandbox.
 * Le client est créé une seule fois et réutilisé pour chaque requête.
 *
 * @returns {paypal.core.PayPalHttpClient}
 */
function getPayPalClient() {
  if (!getPayPalClient.instance) {
    const environment = new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
    getPayPalClient.instance = new paypal.core.PayPalHttpClient(environment);
  }
  return getPayPalClient.instance;
}

/**
 * Calcule la date de fin d'un abonnement à partir de la période demandée.
 *
 * @param {'week'|'month'|'year'} period - Période d'abonnement.
 * @param {Date} from - Date de départ (généralement maintenant).
 * @returns {Date} Date de fin calculée.
 */
function computeEndDate(period, from) {
  switch (period) {
    case 'week':
      return addDays(from, 7);
    case 'month':
      return addMonths(from, 1);
    case 'year':
      return addYears(from, 1);
    default:
      // Cette branche ne devrait jamais être atteinte grâce à la validation préalable.
      throw new Error(`Période non supportée : ${period}`);
  }
}

/**
 * Valide le corps de la requête de capture de don.
 *
 * @param {object} body - Le corps de la requête.
 * @returns {{ valid: boolean, message?: string }}
 */
function validateCaptureBody(body) {
  const { txn_id, amount, period } = body;

  if (!txn_id || !amount || !period) {
    return {
      valid: false,
      message:
        'Champs requis manquants : txn_id, amount et period sont obligatoires',
    };
  }

  if (isNaN(amount) || Number(amount) <= 0) {
    return {
      valid: false,
      message: 'Montant invalide : doit être un nombre positif',
    };
  }

  const validPeriods = ['week', 'month', 'year'];
  if (!validPeriods.includes(period)) {
    return {
      valid: false,
      message: `Période invalide. Valeurs acceptées : ${validPeriods.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Récupère le dernier abonnement d'un utilisateur, trié par date de début décroissante.
 *
 * @param {string} userId - Identifiant de l'utilisateur.
 * @returns {Promise<object|null>} Document d'abonnement ou null s'il n'existe pas.
 */
async function getLatestSubscription(userId) {
  return Subscription.findOne({ userId })
    .sort({ startDate: -1 })
    .lean()
    .exec();
}

/**
 * Vérifie si un abonnement est encore actif.
 *
 * @param {object|null} subscription - Document d'abonnement.
 * @returns {boolean}
 */
function isSubscriptionActive(subscription) {
  return (
    subscription &&
    new Date(subscription.endDate) > new Date()
  );
}

/**
 * GET /api/subscription/status
 * Retourne l'état d'abonnement de l'utilisateur authentifié.
 */
router.get('/status', authMiddleware(), async (req, res) => {
  try {
    const subscription = await getLatestSubscription(req.user.id);
    const subscribed = isSubscriptionActive(subscription);
    res.json({ subscribed });
  } catch (err) {
    console.error('Erreur récupération statut abonnement:', err);
    res
      .status(500)
      .json({ message: 'Erreur serveur', error: err.message });
  }
});

/**
 * POST /api/subscription/capture-donate
 * Capture un paiement PayPal et crée un abonnement actif.
 */
router.post('/capture-donate', authMiddleware(), async (req, res) => {
  const validation = validateCaptureBody(req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const { txn_id, amount, period } = req.body;

  try {
    // Vérifie que la commande PayPal est bien COMPLETED
    const request = new paypal.orders.OrdersGetRequest(txn_id);
    const response = await getPayPalClient().execute(request);

    if (response.result.status !== 'COMPLETED') {
      return res
        .status(400)
        .json({ message: 'Paiement non finalisé (statut ≠ COMPLETED)' });
    }

    const now = new Date();
    const endDate = computeEndDate(period, now);

    const subscription = new Subscription({
      userId: req.user.id,
      amount: parseFloat(amount),
      period,
      startDate: now,
      endDate,
      orderID: txn_id,
      status: 'active',
    });

    await subscription.save();

    console.log(
      `Abonnement ${period} activé pour user ${req.user.id} - Order: ${txn_id}`
    );
    res.json({
      status: 'success',
      message: 'Abonnement activé avec succès',
    });
  } catch (err) {
    console.error(
      'Erreur capture don PayPal:',
      err.response?.data || err.message
    );
    res.status(500).json({
      message: 'Erreur lors de la validation du paiement PayPal',
      error: err.message,
    });
  }
});

module.exports = router;