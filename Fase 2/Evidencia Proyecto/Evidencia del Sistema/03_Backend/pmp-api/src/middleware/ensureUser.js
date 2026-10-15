// src/middleware/ensureUser.js
import {VALID_ROLES} from "../constants/roles.js";
import { pool } from "../db.js";

export function createEnsureUser(dbPool = pool) {
  return async function ensureUserMiddleware(req, res, next) {
    try {
      const fb = req.firebase;
      if (!fb?.uid) return res.status(401).json({ error: "Missing Firebase context" });

      const email = fb.email ? String(fb.email).trim() : null;
      if (!email) return res.status(401).json({ error: "Missing email in Firebase token" });

      const userRes = await dbPool.query(
        `
        SELECT id, nombre, apellido, correo, rol, activo, firebase_uid
        FROM pmp.usuarios
        WHERE firebase_uid=$1 OR lower(correo)=lower($2);
        `,
        [fb.uid,email]
      );

      if (userRes.rowCount === 0) {
        return res.status(403).json({
          error: "Usuario no habilitado",
          detail: "El usuario no existe en la base de datos o no tiene acceso asignado."
        });
      }

      if(userRes.rowCount!==1)return res.status(403).json({code:'IDENTITY_CONFLICT',message:'La identidad no tiene una vinculación única. Solicita revisión al administrador.'});
      const user = userRes.rows[0];
      if((user.firebase_uid&&user.firebase_uid!==fb.uid)||String(user.correo).toLowerCase()!==email.toLowerCase())
        return res.status(403).json({code:'IDENTITY_CONFLICT',message:'La identidad autenticada no coincide con su vinculación. Requiere revisión administrativa.'});

      if (user.activo !== true) {
        return res.status(403).json({
          code: "USER_INACTIVE", error: "Usuario inactivo",
          detail: "El usuario existe, pero esta deshabilitado en la base de datos."
        });
      }

      const rol = user.rol ? String(user.rol).trim() : null;

      if(!VALID_ROLES.includes(rol)) return res.status(403).json({code:"INVALID_ROLE",message:"Rol no autorizado"});

      req.user = {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        correo: user.correo,
        rol,
        activo: user.activo,
        roles: rol ? [rol] : []
      };

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export const ensureUser = createEnsureUser();
