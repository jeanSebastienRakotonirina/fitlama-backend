const jwt = require('jsonwebtoken');

/**
 * Middleware d'authentification JWT.
 *
 * @param {string} [requiredRole] - Rôle requis pour accéder à la route (facultatif).
 * @returns {function} Middleware Express (req, res, next).
 *
 * Le middleware extrait le token JWT depuis l'en-tête `Authorization`,
 * le vérifie avec la clé secrète définie dans `process.env.JWT_SECRET`,
 * attache les informations décodées à `req.user` et, le cas échéant,
 * vérifie que l'utilisateur possède le rôle attendu.
 *
 * Réponses JSON :
 * - 401 : token manquant ou invalide.
 * - 403 : rôle insuffisant.
 */
module.exports = (requiredRole) => {
  // Vérification précoce de la configuration du secret JWT.
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined in environment variables');
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  return (req, res, next) => {
    // Extraction du token depuis l'en-tête Authorization : "Bearer <token>"
    const authHeader = req.header('Authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Aucun token fourni' });
    }

    try {
      // Décodage et vérification du token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      // Vérification du rôle si un rôle est spécifié
      if (requiredRole && req.user.role !== requiredRole) {
        return res.status(403).json({ message: 'Accès non autorisé' });
      }

      // Passage au middleware suivant
      return next();
    } catch (error) {
      // jwt.verify lève une exception en cas de token invalide ou expiré
      return res.status(401).json({ message: 'Token invalide' });
    }
  };
};