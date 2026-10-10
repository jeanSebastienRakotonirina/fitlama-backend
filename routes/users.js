const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * Send a JSON error response with a 500 status code.
 *
 * @param {express.Response} res - Express response object.
 * @param {string} userMessage - Message intended for the client (in French).
 * @param {Error} err - Original error object.
 */
function sendServerError(res, userMessage, err) {
  console.error(userMessage, err);
  res.status(500).json({ message: userMessage, error: err.message });
}

/**
 * GET /users
 * Retrieve the list of all users (admin only). Password fields are omitted.
 */
router.get(
  '/',
  authMiddleware('admin'),
  async (req, res) => {
    try {
      const users = await User.find().select('-password');
      res.json(users);
    } catch (err) {
      sendServerError(res, 'Erreur récupération utilisateurs', err);
    }
  }
);

/**
 * DELETE /users/:id
 * Delete a user by its identifier (admin only).
 *
 * @param {express.Request} req - Express request object, expects `req.params.id`.
 * @param {express.Response} res - Express response object.
 */
router.delete(
  '/:id',
  authMiddleware('admin'),
  async (req, res) => {
    const { id } = req.params;

    // Validate MongoDB ObjectId format before attempting deletion.
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Identifiant utilisateur invalide' });
    }

    try {
      await User.findByIdAndDelete(id);
      res.json({ message: 'Utilisateur supprimé' });
    } catch (err) {
      sendServerError(res, 'Erreur suppression utilisateur', err);
    }
  }
);

module.exports = router;