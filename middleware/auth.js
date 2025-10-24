import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Authentification requise' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }
    req.user = { id: user._id, role: user.role, subscription: user.subscription };
    next();
  } catch (error) {
    console.error('Erreur authentification:', error);
    res.status(401).json({ message: 'Token invalide' });
  }
};

export default auth;