// Use after authMiddleware: router.get('/x', authMiddleware, requireRole(['admin', 'chartering_manager']), handler)
module.exports = function requireRole(allowedRoles) {
  const allowed = new Set(Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]);
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ message: 'You do not have access to this resource' });
    }
    next();
  };
};
