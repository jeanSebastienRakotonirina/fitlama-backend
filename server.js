const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const plansRoutes = require('./routes/plans');
const paymentsRoutes = require('./routes/payments');
const subscriptionsRoutes = require('./routes/subscriptions');
require('dotenv').config(); // Add dotenv to load .env variables

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Validate MONGODB_URI
if (!process.env.MONGODB_URI) {
  console.error('Erreur: MONGODB_URI non défini dans le fichier .env');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connecté à MongoDB');
}).catch(err => {
  console.error('Erreur connexion MongoDB:', err);
  process.exit(1);
});

app.use('/api/auth', authRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);

app.get('/', (req, res) => {
  res.send('API Fitlama est en cours d\'exécution');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
