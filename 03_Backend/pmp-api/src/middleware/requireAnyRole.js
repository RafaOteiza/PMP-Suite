export function requireAnyRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.rol;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}
