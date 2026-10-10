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
  CORS_ORIGINS = [
    'https://fitlama-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
} = process.env;

// -----------------------------------------------------------------------------
// Express application setup
// -----------------------------------------------------------------------------
const app = express();

/**
 * Trust the first proxy (required on platforms like Vercel).
 * Must be set before any middleware that relies on the client IP.
 */
app.set('trust proxy', 1);

/**
 * CORS configuration – restrict origins to known front‑ends.
 */
app.use(
  cors({
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

/**
 * Body parser – automatically parses JSON payloads.
 */
app.use(express.json());

// -----------------------------------------------------------------------------
// Rate limiting
// -----------------------------------------------------------------------------
/**
 * General API limiter (applied to all routes under /api).
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max requests per IP
  message: 'Trop de requêtes depuis cette IP, réessayez dans 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth‑specific limiter (login & register) – stricter to mitigate brute force.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Apply rate limiters.
 * Auth routes get the stricter limiter, then the generic limiter for the rest.
 */
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', apiLimiter);

// -----------------------------------------------------------------------------
// Route registration
// -----------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/users', usersRoutes);

/**
 * Health‑check endpoint – useful for monitoring and CI.
 * Remember to remove or protect it in a production environment if needed.
 */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: NODE_ENV,
  });
});

// -----------------------------------------------------------------------------
// Database connection & server start
// -----------------------------------------------------------------------------
/**
 * Connect to MongoDB and start the HTTP server.
 * Exits the process if the connection fails.
 */
async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');
  } catch (err) {
    console.error('❌ Erreur connexion MongoDB:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`🌍 Environnement : ${NODE_ENV}`);
  });
}

// Graceful shutdown on unhandled promise rejections / uncaught exceptions
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
  process.exit(1);
});

startServer();