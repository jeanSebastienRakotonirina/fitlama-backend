import express from 'express';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import auth from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

router.get('/all', auth, async (req, res) => {
  try {
    console.log('GET /api/users/all - Request received', { userId: req.user.id });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('GET /api/users/all - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.role !== 'superadmin') {
      console.error('GET /api/users/all - Access denied:', { role: user.role });
      return res.status(403).json({ message: 'Accès réservé aux superadmins' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    console.log('GET /api/users/all - Query parameters:', { page, limit, skip });
    const users = await User.find()
      .select('-password')
      .skip(skip)
      .limit(limit);
    const total = await User.countDocuments();
    console.log('GET /api/users/all - Users fetched:', { count: users.length, total });
    res.json({ users, total });
  } catch (error) {
    console.error('GET /api/users/all - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    console.log('POST /api/users - Request received', { userId: req.user.id, body: req.body });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('POST /api/users - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.role !== 'superadmin') {
      console.error('POST /api/users - Access denied:', { role: user.role });
      return res.status(403).json({ message: 'Accès réservé aux superadmins' });
    }
    const { email, password, role, subscription } = req.body;
    if (!email || !password || !role || !subscription) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }
    if (!['none', 'basic', 'premium'].includes(subscription.plan)) {
      return res.status(400).json({ message: 'Abonnement invalide' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email déjà utilisé' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      password: hashedPassword,
      role,
      subscription
    });
    await newUser.save();
    console.log('POST /api/users - User created successfully', { userId: newUser._id });
    res.status(201).json({ id: newUser._id, email: newUser.email, role: newUser.role, subscription: newUser.subscription });
  } catch (error) {
    console.error('POST /api/users - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    console.log('PUT /api/users/:id - Request received', { userId: req.user.id, targetUserId: req.params.id });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('PUT /api/users/:id - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.role !== 'superadmin') {
      console.error('PUT /api/users/:id - Access denied:', { role: user.role });
      return res.status(403).json({ message: 'Accès réservé aux superadmins' });
    }
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      console.error('PUT /api/users/:id - Target user not found:', req.params.id);
      return res.status(404).json({ message: 'Utilisateur cible non trouvé' });
    }
    const { email, password, role, subscription } = req.body;
    if (!email || !role || !subscription) {
      return res.status(400).json({ message: 'Email, rôle et abonnement requis' });
    }
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }
    if (!['none', 'basic', 'premium'].includes(subscription.plan)) {
      return res.status(400).json({ message: 'Abonnement invalide' });
    }
    targetUser.email = email;
    if (password) {
      targetUser.password = await bcrypt.hash(password, 10);
    }
    targetUser.role = role;
    targetUser.subscription = subscription;
    await targetUser.save();
    console.log('PUT /api/users/:id - User updated successfully', { userId: req.params.id });
    res.json({ id: targetUser._id, email: targetUser.email, role: targetUser.role, subscription: targetUser.subscription });
  } catch (error) {
    console.error('PUT /api/users/:id - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    console.log('DELETE /api/users/:id - Request received', { userId: req.user.id, targetUserId: req.params.id });
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('DELETE /api/users/:id - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.role !== 'superadmin') {
      console.error('DELETE /api/users/:id - Access denied:', { role: user.role });
      return res.status(403).json({ message: 'Accès réservé aux superadmins' });
    }
    if (req.user.id === req.params.id) {
      console.error('DELETE /api/users/:id - Cannot delete self');
      return res.status(400).json({ message: 'Impossible de supprimer son propre compte' });
    }
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      console.error('DELETE /api/users/:id - Target user not found:', req.params.id);
      return res.status(404).json({ message: 'Utilisateur cible non trouvé' });
    }
    await User.deleteOne({ _id: req.params.id });
    console.log('DELETE /api/users/:id - User deleted successfully', { userId: req.params.id });
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('DELETE /api/users/:id - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;