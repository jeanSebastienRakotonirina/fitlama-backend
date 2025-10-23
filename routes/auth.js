import express from 'express';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/login', async (req, res) => {
  console.log('POST /api/auth/login - Request received', {
    timestamp: new Date().toISOString(),
    body: { email: req.body.email }
  });
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      console.error('POST /api/auth/login - Missing email or password');
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    console.log('POST /api/auth/login - Fetching user by email:', email);
    const user = await User.findOne({ email });
    if (!user) {
      console.error('POST /api/auth/login - User not found:', email);
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }
    console.log('POST /api/auth/login - User found:', { id: user._id, role: user.role });

    console.log('POST /api/auth/login - Comparing passwords');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.error('POST /api/auth/login - Password mismatch');
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    console.log('POST /api/auth/login - Generating JWT');
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('POST /api/auth/login - Login successful for user:', { id: user._id, role: user.role });
    res.json({ token, role: user.role });
  } catch (error) {
    console.error('POST /api/auth/login - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/register', async (req, res) => {
  console.log('POST /api/auth/register - Request received', {
    timestamp: new Date().toISOString(),
    body: { email: req.body.email }
  });
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      console.error('POST /api/auth/register - Missing email or password');
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    if (!/.+@.+\..+/.test(email)) {
      console.error('POST /api/auth/register - Invalid email format:', email);
      return res.status(400).json({ message: 'Email invalide' });
    }
    if (password.length < 6) {
      console.error('POST /api/auth/register - Password too short');
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    console.log('POST /api/auth/register - Checking for existing user with email:', email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.error('POST /api/auth/register - User already exists:', email);
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    console.log('POST /api/auth/register - Creating new user');
    const user = new User({
      email,
      password,
      role: 'user'
    });
    await user.save();
    console.log('POST /api/auth/register - User created:', { id: user._id, email, role: user.role });

    console.log('POST /api/auth/register - Generating JWT');
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('POST /api/auth/register - Registration successful for user:', { id: user._id, role: user.role });
    res.status(201).json({ token, role: user.role });
  } catch (error) {
    console.error('POST /api/auth/register - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;