import {authorize} from '../security/authorization.js';
import {labAvailableSql} from '../services/labArrival.js';
import { Router } from "express";
import { pool } from "../db.js";
import { firebaseAuth } from "../middleware/firebaseAuth.js";
import { ensureUser } from "../middleware/ensureUser.js";
import { enforceReadOnlyRole } from "../middleware/readOnlyRole.js";
import { requireAnyRole } from "../middleware/requireAnyRole.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);

// ==========================================
// 1. DASHBOARD GENERAL (KPIs)
// ==========================================
router.get("/stats", authorize('supervision.read'), async (req, res, next) => {
  try {
    // Cuenta equipos en Laboratorio (Ubicación 2)
    // Filtra: Totales, Sin Asignar y Listos (Estado 10)
    const sql = `
        SELECT
            COUNT(*) FILTER (WHERE estado_id IN (4,5,9,10)) as total_laboratorio,
            COUNT(*) FILTER (WHERE tecnico_laboratorio_id IS NULL AND estado_id IN (4,5)) as sin_asignar,
            COUNT(*) FILTER (WHERE estado_id = 10) as listos_para_despacho
        FROM pmp.ordenes_servicio o
        WHERE ${labAvailableSql()}
    `;
    const result = await pool.query(sql);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. LISTA DE DESPACHO (Equipos Finalizados)
// ==========================================
router.get("/dispatch-queue", authorize('supervision.read'), async (req, res, next) => {
  try {
    // Busca equipos en Estado 10 (FINALIZADO_TALLER)
    // Trae datos del equipo, la falla y quién lo reparó
    const sql = `
      SELECT
        o.codigo_os,
        o.fecha,
        o.falla,
        o.tipo_equipo,
        o.bus_ppu,
        COALESCE(o.validador_serie, o.consola_serie) as serie,
        u.nombre || ' ' || u.apellido as tecnico_reparador,
        r.fecha_registro as fecha_reparacion,
        r.accion_realizada
      FROM pmp.ordenes_servicio o
      LEFT JOIN pmp.usuarios u ON o.tecnico_laboratorio_id = u.id
      LEFT JOIN LATERAL (SELECT * FROM pmp.registro_reparaciones x WHERE x.codigo_os=o.codigo_os ORDER BY x.fecha_registro DESC LIMIT 1) r ON true
      WHERE o.estado_id = 10 AND ${labAvailableSql()}
      ORDER BY r.fecha_registro DESC
    `;
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. DESPACHAR A BODEGA
// ==========================================
router.post("/dispatch", authorize('lab.custody'),(req,res)=>res.status(410).json({error:'EXPLICIT_CUSTODY_REQUIRED',message:'Utiliza Despacho de Laboratorio: cada equipo requiere validación propia y confirmación de salida.'}));

export default router;
