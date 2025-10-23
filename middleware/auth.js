import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.error('authMiddleware: No token provided');
      return res.status(401).json({ message: 'Token requis' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('authMiddleware: Token decoded', { userId: decoded.id, role: decoded.role });

    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      console.error('authMiddleware: Invalid user ID in token', { userId: decoded.id });
      return res.status(400).json({ message: 'ID utilisateur invalide dans le token' });
    }

    const user = await User.findById(decoded.id).select('email role subscription');
    if (!user) {
      console.error('authMiddleware: User not found', { userId: decoded.id });
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }

    req.user = {
      id: decoded.id,
      role: user.role || decoded.role || 'user', // Fallback to 'user' if role is missing
      subscription: user.subscription || { plan: 'none', isActive: false }
    };
    console.log('authMiddleware: User authenticated', { userId: req.user.id, role: req.user.role });
    next();
  } catch (error) {
    console.error('authMiddleware: Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(401).json({ message: 'Token invalide' });
  }
};
export default authMiddleware