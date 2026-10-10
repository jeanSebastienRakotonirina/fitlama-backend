const jwt = require('jsonwebtoken');

/**
 * Factory function that creates an authentication middleware.
 *
 * @param {string} [requiredRole] - Optional role that the authenticated user must have.
 * @returns {function} Express middleware handling JWT verification and optional role check.
 *
 * @example
 * // Protect a route for admins only
 * app.get('/admin', authMiddleware('admin'), (req, res) => { … });
 *
 * @throws {Error} If the JWT secret is not defined in the environment.
 */
module.exports = (requiredRole) => {
  // Ensure the secret is available at load time – this fails fast during app start‑up.
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret (process.env.JWT_SECRET) is not defined');
  }

  /**
   * Express middleware that validates the JWT sent in the Authorization header.
   *
   * @param {object} req  - Express request object.
   * @param {object} res  - Express response object.
   * @param {function} next - Callback to pass control to the next middleware.
   */
  return (req, res, next) => {
    // Expected format: "Bearer <token>"
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Aucun token fourni' });
    }

    try {
      const decoded = jwt.verify(token, secret);
      // Attach the decoded payload to the request for downstream handlers.
      req.user = decoded;

      // If a role is required, enforce it.
      if (requiredRole && req.user.role !== requiredRole) {
        return res.status(403).json({ message: 'Accès non autorisé' });
      }

      return next();
    } catch (error) {
      // jwt.verify throws on invalid token, expiration, etc.
      return res.status(401).json({ message: 'Token invalide' });
    }
  };
};