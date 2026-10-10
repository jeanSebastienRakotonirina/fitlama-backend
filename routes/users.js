const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

/**
 * Centralised async route handler to avoid repetitive try/catch blocks.
 *
 * @param {Function} fn Async route handler.
 * @returns {Function} Express middleware.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * GET /users
 * Retrieve the list of all users (admin only). Password hashes are omitted.
 *
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
router.get(
  '/',
  authMiddleware('admin'),
  asyncHandler(async (req, res) => {
    const users = await User.find().select('-password');
    res.json(users);
  })
);

/**
 * DELETE /users/:id
 * Delete a user by its identifier (admin only).
 *
 * @param {Object} req Express request, expects `req.params.id`.
 * @param {Object} res Express response.
 */
router.delete(
  '/:id',
  authMiddleware('admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Basic validation of MongoDB ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ message: 'Identifiant utilisateur invalide' });
    }

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json({ message: 'Utilisateur supprimé' });
  })
);

/**
 * Global error handler for this router.
 * Sends a JSON payload with a generic message and the original error details.
 *
 * @param {Error} err The error object.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 * @param {Function} next Next middleware (unused).
 */
router.use((err, req, res, next) => {
  console.error('Route error:', err);
  res.status(500).json({
    message: 'Erreur serveur',
    error: err.message,
  });
});

module.exports = router;