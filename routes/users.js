const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

router.get('/', authMiddleware('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Erreur récupération utilisateurs', error: err.message });
  }
});

router.delete('/:id', authMiddleware('admin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Erreur suppression utilisateur', error: err.message });
  }
});

module.exports = router;