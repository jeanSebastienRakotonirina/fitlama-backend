const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

/**
 * Generate a JWT for a given user.
 *
 * @param {Object} user - Mongoose user document.
 * @returns {string} Signed JWT.
 */
function generateToken(user) {
  const payload = { id: user._id, role: user.role };
  const secret = process.env.JWT_SECRET;
  // In production the secret should always be defined.
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

/**
 * Register a new user.
 *
 * Expected body: { email: string, password: string }
 */
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation – keep behaviour unchanged (400 on missing fields)
  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Utilisateur déjà existant' });
    }

    // Assume password hashing is handled by the User model (e.g., pre‑save hook)
    const newUser = new User({ email, password });
    await newUser.save();

    const token = generateToken(newUser);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

/**
 * Authenticate an existing user.
 *
 * Expected body: { email: string, password: string }
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation – keep behaviour unchanged (400 on missing fields)
  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Utilisateur non trouvé' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(400).json({ message: 'Mot de passe incorrect' });
    }

    const token = generateToken(user);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;