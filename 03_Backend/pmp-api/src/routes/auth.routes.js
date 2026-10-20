import { Router } from "express";
import { firebaseAuth } from "../middleware/firebaseAuth.js";
import { ensureUser } from "../middleware/ensureUser.js";
import { enforceReadOnlyRole } from "../middleware/readOnlyRole.js";
import admin from "../firebase.js";

const router = Router();
router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Perfil interno del usuario autenticado (Firebase)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil OK
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Usuario no habilitado o inactivo en PostgreSQL
 */
router.get("/me", async (req, res) => {
  res.json({ user: req.user, firebase: req.firebase });
});

/**
 * @openapi
 * /api/auth/reset-password-link:
 *   post:
 *     tags: [Auth]
 *     summary: Generar link de reseteo de contrasena para el usuario autenticado
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: OK }
 *       401: { description: No autenticado }
 *       403: { description: Usuario no habilitado o inactivo en PostgreSQL }
 */
router.post("/reset-password-link", async (req, res, next) => {
  try {
    const correo = req.user?.correo;
    if (!correo) return res.status(400).json({ error: "Correo no disponible para el usuario" });
    const link = await admin.auth().generatePasswordResetLink(correo);
    res.json({ correo, link });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/my/reset-password-link:
 *   post:
 *     tags: [Auth]
 *     summary: Generar link de reseteo de contrasena (self-service)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: OK }
 *       401: { description: No autenticado }
 *       403: { description: Usuario no habilitado o inactivo en PostgreSQL }
 */
router.post("/my/reset-password-link", async (req, res, next) => {
  try {
    const correo = req.user?.correo;
    if (!correo) return res.status(400).json({ error: "Correo no disponible para el usuario" });
    const link = await admin.auth().generatePasswordResetLink(correo);
    res.json({ correo, link });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/password:
 *   post:
 *     tags: [Auth]
 *     summary: Cambiar password propio (self-service)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password: { type: string, minLength: 8, example: "NuevoPass123" }
 *             required: [password]
 *     responses:
 *       200: { description: OK }
 *       400: { description: Datos invalidos }
 *       401: { description: No autenticado }
 *       403: { description: Usuario no habilitado o inactivo en PostgreSQL }
 */
router.post("/password", async (req, res, next) => {
  try {
    const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "password invalido", detail: "minimo 8 caracteres" });
    }
    const uid = req.firebase?.uid;
    if (!uid) return res.status(401).json({ error: "Missing Firebase uid" });

    try {
      await admin.auth().updateUser(uid, { password });
      return res.json({ ok: true });
    } catch (err) {
      if (err?.code === "auth/user-not-found") {
        try {
          const correo = req.user?.correo || req.firebase?.email || undefined;
          const displayName = `${req.user?.nombre || ""} ${req.user?.apellido || ""}`.trim() || undefined;
          await admin.auth().createUser({
            uid,
            email: correo,
            password,
            displayName
          });
          return res.json({ ok: true, recreated: true });
        } catch (createErr) {
          return res.status(400).json({
            error: "No se pudo recrear usuario en Firebase",
            detail: createErr?.code || "firebase_error"
          });
        }
      }
      const code = err?.code || undefined;
      if (code) {
        return res.status(400).json({ error: "No se pudo actualizar password en Firebase", detail: code });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

export default router;
