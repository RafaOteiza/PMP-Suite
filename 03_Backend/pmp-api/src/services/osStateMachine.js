import { pool } from "../db.js";

export async function canTransition({ osId, from, to, role }) {
  const q = `
    SELECT requiere_guia, requiere_comentario
    FROM pmp.os_transiciones
    WHERE desde_estado = $1 AND hacia_estado = $2 AND rol_requerido = $3 AND activo = TRUE
    LIMIT 1;
  `;
  const r = await pool.query(q, [from, to, role]);
  if (r.rowCount === 0) return { ok: false };
  return { ok: true, ...r.rows[0] };
}

export async function changeState({ osId, toEstado, usuarioId, rol, comentario = null, meta = {} }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const osRow = await client.query(
      `SELECT id, estado_actual FROM pmp.os WHERE id = $1 FOR UPDATE`,
      [osId]
    );
    if (osRow.rowCount === 0) {
      const e = new Error("OS not found");
      e.status = 404;
      throw e;
    }

    const fromEstado = osRow.rows[0].estado_actual;

    const rule = await client.query(
      `SELECT requiere_guia, requiere_comentario
       FROM pmp.os_transiciones
       WHERE desde_estado=$1 AND hacia_estado=$2 AND rol_requerido=$3 AND activo=TRUE
       LIMIT 1`,
      [fromEstado, toEstado, rol]
    );
    if (rule.rowCount === 0) {
      const e = new Error(`Transition not allowed: ${fromEstado} -> ${toEstado} for role ${rol}`);
      e.status = 409;
      throw e;
    }

    const { requiere_guia, requiere_comentario } = rule.rows[0];

    if (requiere_comentario && (!comentario || comentario.trim().length < 3)) {
      const e = new Error("Comentario requerido para esta transicion");
      e.status = 400;
      throw e;
    }

    // Nota: "requiere_guia" se valida a nivel endpoint cuando implementemos guias.
    // Por ahora dejamos la marca en meta o forzamos meta.guia_id en el endpoint.
    if (requiere_guia && !meta?.guia_id) {
      const e = new Error("guia_id requerido para esta transicion");
      e.status = 400;
      throw e;
    }

    await client.query(
      `UPDATE pmp.os
       SET estado_actual=$2, actualizado_en=NOW()
       WHERE id=$1`,
      [osId, toEstado]
    );

    await client.query(
      `INSERT INTO pmp.os_eventos(os_id, evento_tipo, desde_estado, hacia_estado, usuario_id, rol, comentario, meta)
       VALUES ($1,'STATE_CHANGE',$2,$3,$4,$5,$6,$7::jsonb)`,
      [osId, fromEstado, toEstado, usuarioId, rol, comentario, JSON.stringify(meta || {})]
    );

    await client.query("COMMIT");
    return { os_id: osId, from: fromEstado, to: toEstado };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
