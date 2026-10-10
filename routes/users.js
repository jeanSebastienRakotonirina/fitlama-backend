const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * Send a JSON response with a 500 status code and a standardized error payload.
 *
 * @param {express.Response} res - Express response object.
 * @param {string} userMessage - Human‑readable message for the client.
 * @param {Error} error - Original error object.
 */
function handleServerError(res, userMessage, error) {
  console.error(userMessage, error);
  res.status(500).json({
    message: userMessage,
    error: error.message,
  });
}

/**
 * GET /users
 * Retrieve the list of all users (admin only). Password hashes are omitted.
 *
 * @param {express.Request} req
 * @param {express.Response} res
 */
router.get(
  '/',
  authMiddleware('admin'),
  async (req, res) => {
    try {
      const users = await User.find().select('-password');
      res.json(users);
    } catch (err) {
      handleServerError(res, 'Erreur récupération utilisateurs', err);
    }
  }
);

/**
 * DELETE /users/:id
 * Delete a user by its identifier (admin only).
 *
 * @param {express.Request} req
 * @param {express.Response} res
 */
router.delete(
  '/:id',
  authMiddleware('admin'),
  async (req, res) => {
    const { id } = req.params;

    // Validate MongoDB ObjectId format before querying the database.
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Identifiant utilisateur invalide' });
    }

    try {
      const deletedUser = await User.findByIdAndDelete(id);

      if (!deletedUser) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      res.json({ message: 'Utilisateur supprimé' });
    } catch (err) {
      handleServerError(res, 'Erreur suppression utilisateur', err);
    }
  }
);

module.exports = router;