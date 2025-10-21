const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.post('/create-order', auth, async (req, res) => {
  try {
    const response = await axios.post('https://api.paypal.com/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '10.00'
        }
      }],
      application_context: {
        return_url: `${process.env.FRONTEND_URL}/subscription`,
        cancel_url: `${process.env.FRONTEND_URL}/subscription`
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Erreur création commande PayPal:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/capture-order', auth, async (req, res) => {
  try {
    const { orderId } = req.body;
    const response = await axios.post(`https://api.paypal.com/v2/checkout/orders/${orderId}/capture`, {}, {
      headers: {
        'Authorization': `Bearer ${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Erreur capture commande PayPal:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
