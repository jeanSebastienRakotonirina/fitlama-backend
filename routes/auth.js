import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    console.log('POST /api/auth/register - Request received', { email: req.body.email });
    const { email, password } = req.body;
    if (!email || !password) {
      console.error('POST /api/auth/register - Missing email or password');
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.error('POST /api/auth/register - User already exists', { email });
      return res.status(400).json({ message: 'Utilisateur déjà existant' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      role: 'user',
      subscription: { plan: 'none', isActive: false },
      profile: { age: '', taille: '', poids: '', goal: '', level: '', dietary_preference: '' }
    });
    await user.save();
    console.log('POST /api/auth/register - User created', { email });
    res.status(201).json({ message: 'Utilisateur créé avec succès' });
  } catch (error) {
    console.error('POST /api/auth/register - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  try {
    console.log('POST /api/auth/login - Request received', { email: req.body.email });
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      console.error('POST /api/auth/login - User not found', { email });
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.error('POST /api/auth/login - Invalid password', { email });
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    console.log('POST /api/auth/login - Login successful', { userId: user._id, role: user.role });
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        subscription: user.subscription,
        profile: user.profile || { age: '', taille: '', poids: '', goal: '', level: '', dietary_preference: '' }
      }
    });
  } catch (error) {
    console.error('POST /api/auth/login - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;