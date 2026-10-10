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

const app = express();

// -----------------------------------------------------------------------------
// Middleware configuration
// -----------------------------------------------------------------------------
/**
 * Configure trust proxy.
 * Required when the app runs behind a reverse proxy (e.g., Vercel).
 */
app.set('trust proxy', 1);

/**
 * Secure CORS configuration.
 * Replace the wildcard with the exact domains that may access the API.
 */
app.use(
  cors({
    origin: [
      'https://fitlama-frontend.vercel.app', // production frontend
      'http://localhost:3000',               // Next.js dev
      'http://localhost:5173',               // Vite dev
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

/**
 * Parse incoming JSON payloads.
 */
app.use(express.json());

/**
 * Rate limiting.
 * - `apiLimiter` applies globally to all API routes.
 * - `authLimiter` is stricter and applies only to login/register endpoints.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max requests per IP
  message: 'Trop de requêtes depuis cette IP, réessayez dans 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // login / register attempts
  message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply specific limiters before route registration
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
 * Health‑check endpoint.
 * Useful for monitoring and should be removed or protected in production if desired.
 */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// -----------------------------------------------------------------------------
// Server bootstrap
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;

/**
 * Initialise the application:
 * 1. Connect to MongoDB.
 * 2. Start the HTTP server.
 * 3. Register graceful shutdown handlers.
 */
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');
  } catch (err) {
    console.error('❌ Erreur connexion MongoDB:', err);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`⚙️ Environnement : ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown on termination signals
  const shutdown = () => {
    console.log('\n🛑 Signal de fermeture reçu, arrêt du serveur...');
    server.close(() => {
      mongoose.disconnect().finally(() => {
        console.log('🔌 Connexion MongoDB fermée');
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Capture unhandled promise rejections to avoid silent failures
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Rejet de promesse non géré:', reason);
});

startServer();