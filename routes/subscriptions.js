const express = require('express');
const authMiddleware = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const paypal = require('@paypal/checkout-server-sdk');
const { addDays, addMonths, addYears } = require('date-fns');

const router = express.Router();

/**
 * Initialise et retourne un client PayPal configuré en sandbox.
 * Le client est créé une seule fois (singleton) pour éviter de recréer
 * l'environnement à chaque requête.
 *
 * @returns {paypal.core.PayPalHttpClient}
 */
function getPayPalClient() {
  if (!getPayPalClient.client) {
    const environment = new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
    getPayPalClient.client = new paypal.core.PayPalHttpClient(environment);
  }
  return getPayPalClient.client;
}

/**
 * Calcule la date de fin d'un abonnement à partir de la période demandée.
 *
 * @param {Date} startDate - Date de début de l'abonnement.
 * @param {'week'|'month'|'year'} period - Période d'abonnement.
 * @returns {Date} Date de fin calculée.
 */
function calculateEndDate(startDate, period) {
  switch (period) {
    case 'week':
      return addDays(startDate, 7);
    case 'month':
      return addMonths(startDate, 1);
    case 'year':
      return addYears(startDate, 1);
    default:
      // Cette branche ne devrait jamais être atteinte grâce à la validation préalable.
      throw new Error(`Période non supportée : ${period}`);
  }
}

/**
 * Valide le corps de la requête de capture de paiement.
 *
 * @param {object} body - Le corps de la requête.
 * @returns {{ valid: boolean, message?: string }}
 */
function validateCapturePayload(body) {
  const { txn_id, amount, period } = body;

  if (!txn_id || !amount || !period) {
    return {
      valid: false,
      message:
        'Champs requis manquants : txn_id, amount et period sont obligatoires',
    };
  }

  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    return {
      valid: false,
      message: 'Montant invalide : doit être un nombre positif',
    };
  }

  const validPeriods = ['week', 'month', 'year'];
  if (!validPeriods.includes(period)) {
    return {
      valid: false,
      message: `Période invalide. Valeurs acceptées : ${validPeriods.join(
        ', '
      )}`,
    };
  }

  return { valid: true };
}

/**
 * GET /api/subscription/status
 * Retourne le statut d'abonnement de l'utilisateur authentifié.
 */
router.get(
  '/status',
  authMiddleware(),
  async (req, res) => {
    try {
      const subscription = await Subscription.findOne({ userId: req.user.id })
        .sort({ startDate: -1 })
        .lean();

      const subscribed =
        subscription && new Date(subscription.endDate) > new Date();

      res.json({ subscribed });
    } catch (err) {
      console.error('Erreur récupération statut abonnement:', err);
      res
        .status(500)
        .json({ message: 'Erreur serveur', error: err.message });
    }
  }
);

/**
 * POST /api/subscription/capture-donate
 * Capture un paiement PayPal, crée et active l'abonnement correspondant.
 */
router.post(
  '/capture-donate',
  authMiddleware(),
  async (req, res) => {
    const validation = validateCapturePayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const { txn_id, amount, period } = req.body;
    const numericAmount = Number(amount);
    const now = new Date();

    try {
      // Vérifie que la commande PayPal est bien COMPLETED
      const request = new paypal.orders.OrdersGetRequest(txn_id);
      const response = await getPayPalClient().execute(request);

      if (response.result.status !== 'COMPLETED') {
        return res
          .status(400)
          .json({ message: 'Paiement non finalisé (statut ≠ COMPLETED)' });
      }

      // Calcul de la date de fin d'abonnement
      const endDate = calculateEndDate(now, period);

      // Persistance de l'abonnement
      const subscription = new Subscription({
        userId: req.user.id,
        amount: numericAmount,
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
  }
);

module.exports = router;