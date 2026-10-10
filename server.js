import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Routes (ESM, .js extension required)
import authRoutes from './routes/auth.js';
import plansRoutes from './routes/plans.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import usersRoutes from './routes/users.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
dotenv.config();

const {
  MONGODB_URI,
  PORT = 5000,
  NODE_ENV = 'development',
} = process.env;

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------
/**
 * Initialise la connexion à MongoDB.
 * Termine le processus en cas d'échec critique.
 */
async function initMongo() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI n’est pas définie dans le fichier .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.info('✅ Connecté à MongoDB');
  } catch (err) {
    console.error('❌ Erreur de connexion à MongoDB :', err);
    process.exit(1);
  }
}

/**
 * Crée un limiteur de requêtes (rate limiter) avec les paramètres fournis.
 *
 * @param {number} max - Nombre maximal de requêtes autorisées.
 * @param {string} message - Message renvoyé lorsqu’on dépasse la limite.
 * @returns {import('express-rate-limit').RateLimit}
 */
function createRateLimiter(max, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

// -----------------------------------------------------------------------------
// Application setup
// -----------------------------------------------------------------------------
const app = express();

// 1️⃣ Trust proxy – indispensable derrière Vercel ou tout autre reverse‑proxy
app.set('trust proxy', 1);

// 2️⃣ Configuration CORS sécurisée
const corsOptions = {
  origin: [
    'https://fitlama-frontend.vercel.app', // Frontend déployé
    'http://localhost:3000',               // Dev Next.js
    'http://localhost:5173',               // Dev Vite
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

// 3️⃣ Middleware JSON parser
app.use(express.json());

// 4️⃣ Rate limiting
const apiLimiter = createRateLimiter(100, 'Trop de requêtes depuis cette IP, réessayez dans 15 minutes.');
const authLimiter = createRateLimiter(5, 'Trop de tentatives de connexion. Réessayez dans 15 minutes.');

// Limiteur dédié aux endpoints d’authentification
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Limiteur global appliqué à toutes les routes API
app.use('/api', apiLimiter);

// 5️⃣ Enregistrement des routes
app.use('/api/auth', authRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/users', usersRoutes);

// 6️⃣ Endpoint de santé – à retirer en production si souhaité
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: NODE_ENV,
  });
});

// -----------------------------------------------------------------------------
// Server start & graceful shutdown
// -----------------------------------------------------------------------------
async function startServer() {
  await initMongo();

  const server = app.listen(PORT, () => {
    console.info(`🚀 Serveur démarré sur le port ${PORT}`);
    console.info(`⚙️ Environnement : ${NODE_ENV}`);
  });

  // Gestion des signaux de terminaison pour un arrêt propre
  const shutdown = () => {
    console.info('🔌 Signal de fermeture reçu, arrêt du serveur...');
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.info('🛑 Connexion MongoDB fermée.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Capture des promesses non gérées afin d’éviter des plantages silencieux
process.on('unhandledRejection', (reason) => {
  console.error('❗ Promise non gérée :', reason);
  process.exit(1);
});

startServer();