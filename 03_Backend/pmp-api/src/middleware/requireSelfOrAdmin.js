import { ROLES } from "../constants/roles.js";

// Allows access when the caller is admin or is operating on their own user id.
export function requireSelfOrAdmin() {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    if (user.rol === ROLES.ADMIN) return next();

    const targetId = req.params?.id;
    if (targetId && String(targetId) === String(user.id)) return next();

    return res.status(403).json({ error: "Forbidden" });
  };
}
