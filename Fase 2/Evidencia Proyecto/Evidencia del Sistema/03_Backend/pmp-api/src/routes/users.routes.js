import {lockUserAdministration,protectUserChange} from '../security/userAdministration.js';
import {authorize} from '../security/authorization.js';
import { Router } from "express";
import { firebaseAuth } from "../middleware/firebaseAuth.js";
import { ensureUser } from "../middleware/ensureUser.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireSelfOrAdmin } from "../middleware/requireSelfOrAdmin.js";
import { enforceReadOnlyRole } from "../middleware/readOnlyRole.js";
import { ROLES, VALID_ROLES } from "../constants/roles.js";
import admin from "../firebase.js";
import { pool } from "../db.js";

const router = Router();
router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);

function isUndefinedColumn(err) {
  return err?.code === "42703" || String(err?.message || "").includes('column "firebase_uid"');
}

function cleanOptional(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseBooleanQuery(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  const txt = String(value).toLowerCase();
  if (txt === "true") return true;
  if (txt === "false") return false;
  return null;
}

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Listar usuarios (admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: filtro por correo/nombre/apellido
 *       - in: query
 *         name: activo
 *         schema: { type: boolean }
 *       - in: query
 *         name: rol
 *         schema: { type: string }
 *         description: "codigo de rol (ej: tecnico_laboratorio)"
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: OK }
 *       401: { description: No autenticado }
 *       403: { description: No autorizado }
 */
router.get("/", authorize('users.manage'), async (req, res, next) => {
  try {
    const { q, activo, rol, limit = 50, offset = 0 } = req.query;

    const params = [];
    let where = "WHERE 1=1";

    if (q) {
      params.push(`%${q}%`);
      where += ` AND (u.correo ILIKE $${params.length} OR u.nombre ILIKE $${params.length} OR u.apellido ILIKE $${params.length})`;
    }

    const activoVal = parseBooleanQuery(activo);
    if (activoVal !== null) {
      params.push(activoVal);
      where += ` AND u.activo = $${params.length}`;
    }

    const rolFilter = typeof rol === "string" ? rol.trim().toLowerCase() : null;
    if (rolFilter) {
      if (!VALID_ROLES.includes(rolFilter)) {
        return res.status(400).json({ error: "rol invalido" });
      }
      params.push(rolFilter);
      where += ` AND u.rol = $${params.length}`;
    }

    params.push(Number(limit) || 50);
    params.push(Number(offset) || 0);

    const sql = `
      SELECT
        u.id, u.correo, u.nombre, u.apellido, u.rol, u.activo
      FROM pmp.usuarios u
      ${where}
      ORDER BY u.nombre ASC, u.apellido ASC
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;

    const result = await pool.query(sql, params);
    res.json({ items: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Obtener usuario (admin o el mismo usuario)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.get("/:id", requireSelfOrAdmin(), async (req, res, next) => {
  try {
    const { id } = req.params;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

    const sql = `
      SELECT id, correo, nombre, apellido, rol, activo
      FROM pmp.usuarios
      WHERE ${isUuid ? "id = $1::uuid" : "lower(correo) = lower($1)"}
      LIMIT 1;
    `;

    const r = await pool.query(sql, [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Actualizar usuario (solo admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               apellido: { type: string }
 *               correo: { type: string }
 *               rol: { type: string }
 *               activo: { type: boolean }
 *     responses:
 *       200: { description: OK }
 */
router.patch("/:id", authorize('users.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const nombre = cleanOptional(req.body?.nombre);
    const apellido = cleanOptional(req.body?.apellido);
    const correo = cleanOptional(req.body?.correo)?.toLowerCase();
    const rol = cleanOptional(req.body?.rol)?.toLowerCase();
    const activo =
      typeof req.body?.activo === "boolean"
        ? req.body.activo
        : req.body?.activo === "true"
        ? true
        : req.body?.activo === "false"
        ? false
        : null;

    if (nombre === null && apellido === null && correo === null && rol === null && activo === null) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      await lockUserAdministration(client,req.user);
      await protectUserChange(client,req.user,id,{rol,activo});

      let existing;
      try {
        const r = await client.query(
          `SELECT id, correo, nombre, apellido, rol, activo, firebase_uid
           FROM pmp.usuarios WHERE id = $1
           FOR UPDATE`,
          [id]
        );
        existing = r.rowCount ? r.rows[0] : null;
      } catch (err) {
        if (!isUndefinedColumn(err)) {
          throw err;
        }
        const r = await client.query(
          `SELECT id, correo, nombre, apellido, rol, activo
           FROM pmp.usuarios WHERE id = $1
           FOR UPDATE`,
          [id]
        );
        existing = r.rowCount ? { ...r.rows[0], firebase_uid: null } : null;
      }

      if (!existing) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      if (rol !== null && !VALID_ROLES.includes(rol)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "rol invalido" });
      }

      const params = [id];
      const sets = [];

      if (nombre !== null) {
        params.push(nombre);
        sets.push(`nombre = $${params.length}`);
      }
      if (apellido !== null) {
        params.push(apellido);
        sets.push(`apellido = $${params.length}`);
      }
      if (correo !== null) {
        params.push(correo);
        sets.push(`correo = $${params.length}`);
      }
      if (rol !== null) {
        params.push(rol);
        sets.push(`rol = $${params.length}`);
      }
      if (activo !== null) {
        params.push(activo);
        sets.push(`activo = $${params.length}`);
      }

      const updateSql = `
        UPDATE pmp.usuarios
        SET ${sets.join(", ")}
        WHERE id = $1
        RETURNING id, correo, nombre, apellido, rol, activo;
      `;

      const updateRes = await client.query(updateSql, params);
      const updated = { ...updateRes.rows[0], firebase_uid: existing.firebase_uid ?? null };

      const correoChanged = correo !== null && correo !== existing.correo;
      if (correoChanged) {
        const displayName = `${updated.nombre || ""} ${updated.apellido || ""}`.trim();
        try {
          if (existing.firebase_uid) {
            await admin.auth().updateUser(existing.firebase_uid, { email: updated.correo });
          } else {
            const fbUser = await admin.auth().getUserByEmail(existing.correo);
            await admin.auth().updateUser(fbUser.uid, { email: updated.correo });
            try {
              await client.query(`UPDATE pmp.usuarios SET firebase_uid = $2 WHERE id = $1`, [
                id,
                fbUser.uid
              ]);
              updated.firebase_uid = fbUser.uid;
            } catch {
              // columna opcional, ignorar si no existe
            }
          }
        } catch (fbErr) {
          if (fbErr?.code === "auth/user-not-found") {
            // Self-healing: recrea en Firebase y sigue sin romper la transaccion
            try {
              const newUid = updated.firebase_uid || existing.firebase_uid || updated.id;
              const created = await admin.auth().createUser({
                uid: newUid,
                email: updated.correo,
                displayName: displayName || undefined
              });
              try {
                await client.query(`UPDATE pmp.usuarios SET firebase_uid = $2 WHERE id = $1`, [
                  id,
                  created.uid
                ]);
                updated.firebase_uid = created.uid;
              } catch (err) {
                if (!isUndefinedColumn(err)) throw err;
              }
            } catch (createErr) {
              await client.query("ROLLBACK");
              return res
                .status(400)
                .json({ error: "No se pudo recrear usuario en Firebase", detail: createErr?.code || "firebase_error" });
            }
          } else {
          await client.query("ROLLBACK");
          const code = fbErr?.code || "firebase_error";
          return res
            .status(400)
            .json({ error: "No se pudo actualizar correo en Firebase", detail: code });
          }
        }
      }

      await client.query("COMMIT");
      res.json({ user: updated });
    } catch (err) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // ignore rollback errors
        }
      }
      if (err?.code) {
        console.error("PATCH /api/users/:id error", err.code, err.constraint || "");
        if (err.code === "23505") {
          return res.status(400).json({ error: "correo ya existe" });
        }
        if (err.code === "23503") {
          return res.status(400).json({ error: "rol invalido (fk)" });
        }
      }
      next(err);
    } finally {
      if (client) client.release();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/users/{id}/password:
 *   post:
 *     tags: [Users]
 *     summary: Cambiar password de un usuario (admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
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
 *       403: { description: No autorizado }
 *       404: { description: No encontrado }
 */
router.post("/:id/password", authorize('users.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "password invalido", detail: "minimo 8 caracteres" });
    }

    let userRow;
    try {
      const r = await pool.query(
        `SELECT id, correo, firebase_uid FROM pmp.usuarios WHERE id = $1 LIMIT 1`,
        [id]
      );
      userRow = r.rowCount ? r.rows[0] : null;
    } catch (err) {
      if (!isUndefinedColumn(err)) throw err;
      const r = await pool.query(`SELECT id, correo FROM pmp.usuarios WHERE id = $1 LIMIT 1`, [id]);
      userRow = r.rowCount ? { ...r.rows[0], firebase_uid: null } : null;
    }

    if (!userRow) return res.status(404).json({ error: "User not found" });

    const { correo, firebase_uid } = userRow;
    let uid = firebase_uid || null;
    try {
      if (!uid) {
        const fbUser = await admin.auth().getUserByEmail(correo);
        uid = fbUser.uid;
        try {
          await pool.query(`UPDATE pmp.usuarios SET firebase_uid = $2 WHERE id = $1`, [id, uid]);
        } catch (err) {
          if (!isUndefinedColumn(err)) throw err;
        }
      }
      await admin.auth().updateUser(uid, { password });
      return res.json({ ok: true });
    } catch (fbErr) {
      const code = fbErr?.code || "firebase_error";
      return res.status(400).json({ error: "No se pudo actualizar password en Firebase", detail: code });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
