const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

// CORS configuration
app.use(cors({
  origin: '*', // Allow only your frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow necessary headers
  credentials: true // If cookies or auth headers are used
}));

app.set('trust proxy', true); // accepte tous les proxies (moins strict mais très courant)const app = express();
app.use(express.json());

const limiter = rateLimit({
windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 tentatives
  message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  standardHeaders: true,    // retourne les headers RateLimit-*
  legacyHeaders: false,     // désactive les anciens headers X-RateLimit-*
  });
app.use(limiter);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connecté à MongoDB'))
  .catch(err => console.error('Erreur connexion MongoDB:', err));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/users', require('./routes/users'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
