import jwt from 'jsonwebtoken';

export default function auth(req, res, next) {
  console.log('Auth Middleware - Processing request', {
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      console.error('Auth Middleware - No Authorization header provided');
      return res.status(401).json({ message: 'Accès non autorisé: Aucun token fourni' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Auth Middleware - Verifying token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Auth Middleware - Token verified:', { id: decoded.id, role: decoded.role });

    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    console.error('Auth Middleware - Error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(401).json({ message: 'Accès non autorisé: Token invalide' });
  }
}