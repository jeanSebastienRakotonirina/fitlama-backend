const jwt = require('jsonwebtoken');

module.exports = (role) => (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'Aucun token fourni' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    if (role && req.user.role !== role) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalide' });
  }
};