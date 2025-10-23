import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export default async function auth(req, res, next) {
  try {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
      console.error('Auth middleware: No token provided');
      return res.status(401).json({ message: 'Aucun token fourni' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', { message: error.message });
    res.status(401).json({ message: 'Token invalide' });
  }
}
