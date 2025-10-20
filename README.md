# Structure globale du projet

```json
fitlama/
├── backend/
│   ├── models/
│   │   ├── Plan.js
│   │   ├── Subscription.js
│   │   └── User.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── plans.js
│   │   ├── subscriptions.js
│   │   └── users.js
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   └── README.md
├── frontend/
│   ├── public/
│   │   └── vite.svg
│   ├── src/
│   │   ├── assets/ (empty or add logos)
│   │   ├── components/
│   │   │   └── PlanDetail.vue
│   │   ├── stores/
│   │   │   ├── auth.js
│   │   │   └── notification.js
│   │   ├── views/
│   │   │   ├── AdminPlansView.vue
│   │   │   ├── AdminUsersView.vue
│   │   │   ├── GeneratePlanView.vue
│   │   │   ├── HomeView.vue
│   │   │   ├── LoginView.vue
│   │   │   ├── PlansView.vue
│   │   │   ├── RegisterView.vue
│   │   │   └── SubscriptionView.vue
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── router/
│   │       └── index.js
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
└── README.md
```

## Fitlama Backend

Prérequis

Node.js
MongoDB
PayPal Sandbox Account
OpenRouter API Key

## Installation

### Cloner le dépôt

```json
cd backend
npm install
Créer un fichier .env avec les variables nécessaires
npm run dev pour lancer en mode développement
```

### Variables d'environnement

```json
OPENROUTER_API_KEY: Clé API OpenRouter
JWT_SECRET: Secret pour JWT
OPENROUTER_MODEL: Modèle IA utilisé
MONGODB_URI: URI MongoDB
PORT: Port du serveur
FRONTEND_URL: URL du frontend
PAYPAL_CLIENT_ID: ID client PayPal
PAYPAL_CLIENT_SECRET: Secret client PayPal
```

### Routes

```json
/api/auth: Inscription et connexion
/api/plans: Gestion des plans
/api/subscriptions: Gestion des abonnements PayPal
/api/users: Gestion des utilisateurs (admin)
```
