// server.js (ou index.js)

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Importer les routes (en ES module, donc .js obligatoire)
import authRoutes from './routes/auth.js';
import plansRoutes from './routes/plans.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import usersRoutes from './routes/users.js';

dotenv.config();

const app = express();

// 1. IMPORTANT : activer trust proxy AVANT tout le reste (Vercel / proxy)
app.set('trust proxy', 1); // ou true si tu veux être plus permissif

// 2. CORS – configuration sécurisée (remplace * par ton domaine exact)
app.use(cors({
  origin: [
    'https://fitlama-frontend.vercel.app',    // ← ton frontend déployé
    'http://localhost:3000',                  // dev Next.js
    'http://localhost:5173'                   // dev Vite si tu switch encore
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // si tu utilises cookies ou auth avec credentials
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// 3. JSON parser
app.use(express.json());

// 4. Rate limiting – UNIQUEMENT sur les routes sensibles (pas global)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // 100 requêtes max par IP
  message: 'Trop de requêtes depuis cette IP, réessayez dans 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 tentatives login/register
  message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Appliquer le rate-limit spécifique
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', apiLimiter); // limite générale sur toutes les API (100 req/15min)

// 5. Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connecté à MongoDB'))
  .catch(err => {
    console.error('Erreur connexion MongoDB:', err);
    process.exit(1); // Arrête le serveur si MongoDB est mort
  });

// 6. Routes
app.use('/api/auth', authRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/users', usersRoutes);

// 7. Route de test (supprime-la en prod)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// 8. Lancement serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  console.log(`Environnement : ${process.env.NODE_ENV || 'development'}`);
});
