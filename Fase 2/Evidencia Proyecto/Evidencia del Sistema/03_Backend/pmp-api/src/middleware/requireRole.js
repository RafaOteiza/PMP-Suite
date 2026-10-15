// src/middleware/requireRole.js
export function requireRole(roleCode) {
  return (req, res, next) => {
    const userRole = req.user?.rol;
    if (!userRole) return res.status(403).json({ error: "Forbidden" });
    if (userRole !== roleCode) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
