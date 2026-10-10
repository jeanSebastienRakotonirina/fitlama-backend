const jwt = require('jsonwebtoken');

/**
 * Middleware factory that validates a JWT and optionally enforces a user role.
 *
 * @param {string} [requiredRole] - The role that the authenticated user must have.
 *                                   If omitted, only token validation is performed.
 * @returns {function} Express middleware function (req, res, next).
 *
 * @example
 * // Protect a route for admins only
 * app.get('/admin', auth('admin'), (req, res) => { ... });
 *
 * @example
 * // Protect a route for any authenticated user
 * app.get('/profile', auth(), (req, res) => { ... });
 */
module.exports = (requiredRole) => (req, res, next) => {
  // Extract the token from the Authorization header (format: "Bearer <token>")
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Aucun token fourni' });
  }

  // Ensure the secret used for verification is defined
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // This is a server‑side misconfiguration; we log it and respond with a generic error.
    console.error('JWT secret is not defined in environment variables.');
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }

  try {
    // Verify the token and attach the decoded payload to the request object.
    const decoded = jwt.verify(token, secret);
    req.user = decoded;

    // If a role is required, enforce it.
    if (requiredRole && req.user.role !== requiredRole) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Token is valid and role (if any) matches – proceed to the next middleware/handler.
    return next();
  } catch (error) {
    // jwt.verify throws on invalid, expired, or malformed tokens.
    return res.status(401).json({ message: 'Token invalide' });
  }
};