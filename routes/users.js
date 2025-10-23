import express from 'express';
import { User } from '../models/User.js';
import auth from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  console.log('GET /api/users - Request received', {
    userId: req.user.id,
    userRole: req.user.role,
    timestamp: new Date().toISOString()
  });
  try {
    console.log('GET /api/users - Fetching user data for ID:', req.user.id);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('GET /api/users - User not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    console.log('GET /api/users - User found:', { id: user._id, role: user.role });

    if (user.role !== 'superadmin') {
      console.error('GET /api/users - Access denied: User is not superadmin');
      return res.status(403).json({ message: 'Accès réservé aux superadmins' });
    }

    console.log('GET /api/users - Fetching all users');
    const users = await User.find({}, { email: 1, role: 1 });
    console.log('GET /api/users - Users fetched:', { count: users.length });
    res.json(users);
  } catch (error) {
    console.error('GET /api/users - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.put('/:id', auth, async (req, res) => {
  console.log('PUT /api/users/:id - Request received', {
    userId: req.user.id,
    targetUserId: req.params.id,
    userRole: req.user.role,
    timestamp: new Date().toISOString(),
    body: req.body
  });
  try {
    console.log('PUT /api/users/:id - Fetching requesting user data for ID:', req.user.id);
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser) {
      console.error('PUT /api/users/:id - Requesting user not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    console.log('PUT /api/users/:id - Requesting user found:', { id: requestingUser._id, role: requestingUser.role });

    if (requestingUser.role !== 'superadmin') {
      console.error('PUT /api/users/:id - Access denied: User is not superadmin');
      return res.status(403).json({ message: 'Accès réservé aux superadmins' });
    }

    console.log('PUT /api/users/:id - Fetching target user data for ID:', req.params.id);
    const user = await User.findById(req.params.id);
    if (!user) {
      console.error('PUT /api/users/:id - Target user not found:', req.params.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    console.log('PUT /api/users/:id - Target user found:', { id: user._id, email: user.email });

    const { email, role, password } = req.body;
    if (email) user.email = email;
    if (role && ['user', 'admin', 'superadmin'].includes(role)) user.role = role;
    if (password) user.password = await bcrypt.hash(password, 10);

    await user.save();
    console.log('PUT /api/users/:id - User updated successfully:', { id: user._id, email: user.email, role: user.role });
    res.json({ message: 'Utilisateur mis à jour', user: { id: user._id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('PUT /api/users/:id - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  console.log('DELETE /api/users/:id - Request received', {
    userId: req.user.id,
    targetUserId: req.params.id,
    userRole: req.user.role,
    timestamp: new Date().toISOString()
  });
  try {
    console.log('DELETE /api/users/:id - Fetching requesting user data for ID:', req.user.id);
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser) {
      console.error('DELETE /api/users/:id - Requesting user not found:', req.user.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    console.log('DELETE /api/users/:id - Requesting user found:', { id: requestingUser._id, role: requestingUser.role });

    if (requestingUser.role !== 'superadmin') {
      console.error('DELETE /api/users/:id - Access denied: User is not superadmin');
      return res.status(403).json({ message: 'Accès réservé aux superadmins' });
    }

    console.log('DELETE /api/users/:id - Fetching target user data for ID:', req.params.id);
    const user = await User.findById(req.params.id);
    if (!user) {
      console.error('DELETE /api/users/:id - Target user not found:', req.params.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    console.log('DELETE /api/users/:id - Target user found:', { id: user._id, email: user.email });

    if (req.user.id === req.params.id) {
      console.error('DELETE /api/users/:id - Cannot delete self');
      return res.status(400).json({ message: 'Impossible de supprimer son propre compte' });
    }

    await user.deleteOne();
    console.log('DELETE /api/users/:id - User deleted successfully:', req.params.id);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    console.error('DELETE /api/users/:id - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;