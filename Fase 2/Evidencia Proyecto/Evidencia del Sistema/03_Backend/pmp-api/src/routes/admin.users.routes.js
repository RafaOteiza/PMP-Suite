import {lockUserAdministration,protectUserChange} from '../security/userAdministration.js';
import {authorize} from '../security/authorization.js';
import { Router } from "express";
import admin from "../firebase.js";
import { pool } from "../db.js";
import { firebaseAuth } from "../middleware/firebaseAuth.js";
import { ensureUser } from "../middleware/ensureUser.js";
import { requireRole } from "../middleware/requireRole.js";
import { enforceReadOnlyRole } from "../middleware/readOnlyRole.js";
import { ROLES, VALID_ROLES } from "../constants/roles.js";

const router = Router();
router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);

// --- Funciones Auxiliares ---
function normalizeCorreo(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

function cleanOptional(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/**
 * POST /api/admin/users
 * Crear usuario nuevo con contraseña personalizada
 */
router.post("/", authorize('users.manage'), async (req, res, next) => {
  let creationClient;
  try {
    const correo = normalizeCorreo(req.body?.correo);
    const nombre = cleanOptional(req.body?.nombre);
    const apellido = cleanOptional(req.body?.apellido);
    const rol = cleanOptional(req.body?.rol)?.toLowerCase();
    // No shared or implicit password. Existing recovery-link workflow provisions access.
    const password = req.body?.password;
    if(password!==undefined&&(typeof password!=='string'||password.length<8)) return res.status(422).json({error:'La contraseña debe tener al menos 8 caracteres'});

    if (!correo || !nombre || !apellido || !rol) {
      return res.status(400).json({ error: "Faltan datos obligatorios (correo, nombre, apellido, rol)" });
    }
    if (!VALID_ROLES.includes(rol)) {
      return res.status(400).json({ error: "Rol inválido" });
    }

    creationClient=await pool.connect();
    await creationClient.query('BEGIN');
    await lockUserAdministration(creationClient,req.user);
    const existing=await creationClient.query('SELECT id FROM pmp.usuarios WHERE lower(correo)=lower($1)',[correo]);
    if(existing.rowCount){await creationClient.query('ROLLBACK');return res.status(409).json({error:'La cuenta ya existe. Utiliza la edición autorizada.'});}
    let fbUser;
    let firebaseUid = null;

    try {
      try {
        fbUser = await admin.auth().getUserByEmail(correo);

        const conflict=new Error('La identidad ya existe. Requiere revisión de vinculación explícita.');
        conflict.code='IDENTITY_EXISTS';throw conflict;
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          // CREAR con la contraseña recibida
          fbUser = await admin.auth().createUser({
            email: correo,
            displayName: `${nombre} ${apellido}`.trim(),
            disabled: false,
            ...(password ? {password} : {})
          });
        } else {
          throw err;
        }
      }

      firebaseUid = fbUser.uid;
      await admin.auth().setCustomUserClaims(firebaseUid, { rol });

    } catch (fbErr) {
      console.error("Error Firebase POST:", fbErr);
      await creationClient.query("ROLLBACK");
      return res.status(400).json({ error: "Error gestionando usuario en Firebase" });
    }

    // Guardar en PostgreSQL
    const upsert = `
      INSERT INTO pmp.usuarios (correo, nombre, apellido, rol, activo, firebase_uid)
      VALUES ($1, $2, $3, $4, TRUE, $5)
      RETURNING id, correo, nombre, apellido, rol, activo;
    `;

    const result = await creationClient.query(upsert, [correo, nombre, apellido, rol, firebaseUid]);

    await creationClient.query("COMMIT");
    return res.status(201).json({
      user: result.rows[0],
      firebase: { uid: firebaseUid, email: fbUser.email }
    });

  } catch (err) {
    if(creationClient)await creationClient.query("ROLLBACK");
    next(err);
  } finally {creationClient?.release();}
});

/**
 * PUT /api/admin/users/:id
 * Edición con Vinculación Proactiva
 */
router.put("/:id", authorize('users.manage'), async (req, res, next) => {
  const { id } = req.params;
  const nombre = cleanOptional(req.body?.nombre);
  const apellido = cleanOptional(req.body?.apellido);
  const correo = normalizeCorreo(req.body?.correo);
  const rol = cleanOptional(req.body?.rol)?.toLowerCase();

  let activo = null;
  if (req.body.activo !== undefined) {
      activo = req.body.activo === true || req.body.activo === "true";
  }

  if (!nombre && !apellido && !correo && !rol && activo === null) {
    return res.status(400).json({ error: "No hay campos para actualizar" });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await lockUserAdministration(client,req.user);
    await protectUserChange(client,req.user,id,{rol,activo});

    // 1. Validar unicidad correo
    if (correo) {
        const check = await client.query(
            "SELECT id FROM pmp.usuarios WHERE correo = $1 AND id != $2::uuid",
            [correo, id]
        );
        if (check.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "El correo ya está en uso por otro usuario." });
        }
    }

    // 2. Update Postgres
    const sets = [];
    const params = [id];
    let paramIdx = 2;

    if (nombre) { sets.push(`nombre = $${paramIdx++}`); params.push(nombre); }
    if (apellido) { sets.push(`apellido = $${paramIdx++}`); params.push(apellido); }
    if (correo) { sets.push(`correo = $${paramIdx++}`); params.push(correo); }
    if (rol) { sets.push(`rol = $${paramIdx++}`); params.push(rol); }
    if (activo !== null) { sets.push(`activo = $${paramIdx++}`); params.push(activo); }

    const sql = `
        UPDATE pmp.usuarios
        SET ${sets.join(", ")}
        WHERE id = $1::uuid
        RETURNING *, firebase_uid
    `;

    const pgResult = await client.query(sql, params);

    if (pgResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Usuario no encontrado en base de datos." });
    }

    const updatedUser = pgResult.rows[0];

    // 3. Sincronizar Firebase
    try {
        const fbUpdates = {};
        if (correo) fbUpdates.email = correo;
        if (nombre || apellido) fbUpdates.displayName = `${nombre || updatedUser.nombre} ${apellido || updatedUser.apellido}`.trim();
        if (activo !== null) fbUpdates.disabled = !activo;

        let targetUid = updatedUser.firebase_uid || id;

        try {
            await admin.auth().updateUser(targetUid, fbUpdates);

            // --- NUEVO: Vinculación Proactiva ---
            // Si la actualización funcionó y no teníamos el ID guardado en BD, lo guardamos ahora.
            if (!updatedUser.firebase_uid) {
                console.log(`[Fix] Vinculando usuario ${updatedUser.correo} con UID ${targetUid}`);
                await client.query("UPDATE pmp.usuarios SET firebase_uid = $1 WHERE id = $2::uuid", [targetUid, id]);
            }

        } catch (updateErr) {
            if (updateErr.code === 'auth/user-not-found') {
                 // Recuperación por correo
                 try {
                     const recoveredUser = await admin.auth().getUserByEmail(updatedUser.correo);
                     targetUid = recoveredUser.uid;

                     await admin.auth().updateUser(targetUid, fbUpdates);

                     // Guardamos el UID recuperado
                     await client.query("UPDATE pmp.usuarios SET firebase_uid = $1 WHERE id = $2::uuid", [targetUid, id]);

                 } catch (subErr) {
                     throw updateErr; // Activar Self-Healing de Creación
                 }
            } else {
                throw updateErr;
            }
        }

        if (rol) await admin.auth().setCustomUserClaims(targetUid, { rol });

    } catch (fbErr) {
        // Editing a profile must never silently create an authentication identity.
        if (fbErr.code === 'auth/user-not-found') {
            await client.query('ROLLBACK');
            return res.status(409).json({error:'Identidad no vinculada',detail:'Revisa la vinculación y utiliza el procedimiento explícito de alta/recuperación.'});
        } else if (fbErr.code === 'auth/email-already-exists') {
             await client.query("ROLLBACK");
             return res.status(409).json({ error: "El correo ya está registrado en Firebase." });
        } else {
            throw fbErr;
        }
    }

    await client.query("COMMIT");
    res.json({ user: updatedUser });

  } catch (err) {
    if (client) { try { await client.query("ROLLBACK"); } catch (e) {} }
    console.error("Error PUT:", err);
    res.status(err.status||500).json({error:err.code||"Error interno del servidor",message:err.status?err.message:"No se pudo actualizar la cuenta"});
  } finally {
    if (client) client.release();
  }
});

// ... Mantener resto de endpoints (activar/desactivar/passwords) ...
async function toggleActivo(req, res, estado) {
    const { id } = req.params;
    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");
        await lockUserAdministration(client,req.user);
        await protectUserChange(client,req.user,id,{activo:estado});
        const result = await client.query("UPDATE pmp.usuarios SET activo = $1 WHERE id = $2::uuid RETURNING *, firebase_uid", [estado, id]);
        if (result.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        try {
            const targetUid = result.rows[0].firebase_uid || id;
            await admin.auth().updateUser(targetUid, { disabled: !estado });
        } catch (e) { }
        await client.query("COMMIT");
        res.json({ user: result.rows[0] });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        res.status(err.status||500).json({error:err.code||"Error interno del servidor",message:err.status?err.message:"No se pudo actualizar la cuenta"});
    } finally {
        if (client) client.release();
    }
}
router.patch("/:id/activar", authorize('users.manage'), (req, res) => toggleActivo(req, res, true));
router.patch("/:id/desactivar", authorize('users.manage'), (req, res) => toggleActivo(req, res, false));

router.post("/:id/reset-password-link", authorize('users.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const r = await pool.query("SELECT correo FROM pmp.usuarios WHERE id = $1::uuid", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });
    const link = await admin.auth().generatePasswordResetLink(r.rows[0].correo);
    res.json({ correo: r.rows[0].correo, link });
  } catch (err) { next(err); }
});

router.post("/:id/set-password", authorize('users.manage'), async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: "Password muy corto" });
    try {
        const r = await pool.query("SELECT firebase_uid FROM pmp.usuarios WHERE id = $1::uuid", [id]);
        let targetUid = id;
        if (r.rows.length > 0 && r.rows[0].firebase_uid) targetUid = r.rows[0].firebase_uid;
        await admin.auth().updateUser(targetUid, { password });
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ error: "Error actualizando password", detail: e.message });
    }
});

export default router;
