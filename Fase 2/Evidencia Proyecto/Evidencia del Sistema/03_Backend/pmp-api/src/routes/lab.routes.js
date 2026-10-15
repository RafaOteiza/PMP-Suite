import {readLabSupervision} from '../services/labSupervision.js';
import {authorize} from '../security/authorization.js';
import {readWork,saveWork,startWork,finishWork,requestPart} from '../services/labWork.js';
import {readLabReception} from '../services/labReceptionRead.js';
import {validateLabCustody,confirmLabCustody} from '../services/labCustody.js';
import { addFlowEvent, FlowError, requireActiveUserRole } from '../services/bridgeFlow.js';
import { labArrivalJoin, labAvailableSql,labTransitSql,lastLabExitSql } from '../services/labArrival.js';
import { Router, json } from "express";
import { pool } from "../db.js";
import { firebaseAuth } from "../middleware/firebaseAuth.js";
import { requireAnyRole } from "../middleware/requireAnyRole.js";
import { ensureUser } from "../middleware/ensureUser.js";
import { enforceReadOnlyRole } from "../middleware/readOnlyRole.js";
import { ROLES } from "../constants/roles.js";
import { ScanError, requireLatestPhysicalScan } from "../services/equipmentScan.js";

const router = Router();

router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);
router.get('/supervision',authorize('lab.supervise'),async(req,res,next)=>{try{res.json(await readLabSupervision(pool));}catch(e){next(e);}});
router.get('/reception',authorize('lab.supervise'),async(req,res,next)=>{
 try{res.json(await readLabReception(pool,req.query));}catch(e){sendPhysicalScanError(res,e,next);}
});
router.get('/custody/:code',authorize('lab.custody'),async(req,res,next)=>{
 try{
 const row=(await pool.query(`SELECT o.*,COALESCE(o.validador_serie,o.consola_serie) AS serie,COALESCE(v.modelo,c.modelo) AS modelo,COALESCE(v.marca,c.marca) AS marca,
  t.nombre AS terminal,p.nombre AS operador,co.codigo_caso,co.referencia_externa AS referencia_ar,
  concat_ws(' ',u.nombre,u.apellido) AS tecnico_laboratorio,
  ${lastLabExitSql()} fecha_salida_laboratorio,${labTransitSql()} en_camino_laboratorio,${labAvailableSql()} disponible_laboratorio
  FROM pmp.ordenes_servicio o LEFT JOIN pmp.validadores v ON v.serie=o.validador_serie LEFT JOIN pmp.consolas c ON c.serie=o.consola_serie
  LEFT JOIN pmp.terminales t ON t.id=o.terminal_id LEFT JOIN pmp.pst p ON p.codigo=o.pst_codigo
  LEFT JOIN pmp.casos_operacionales co ON co.id=o.caso_id LEFT JOIN pmp.usuarios u ON u.id=o.tecnico_laboratorio_id WHERE o.codigo_os=$1`,[req.params.code])).rows[0];
 if(!row)return res.status(404).json({message:'OS no encontrada'});
 if(!row.en_camino_laboratorio&&!row.disponible_laboratorio)return res.status(403).json({error:'FORBIDDEN',message:'La OS no pertenece a la custodia vigente de Laboratorio.'});
 res.json(row);
 }catch(e){next(e);}
});
for (const purpose of ['RECEPCION','SALIDA']) {
 router.post(`/custody/:code/${purpose}/validar`,authorize('lab.custody'),async(req,res,next)=>{
  try{res.json(await validateLabCustody(pool,req.params.code,purpose,req.body,req.user));}catch(e){sendPhysicalScanError(res,e,next);}
 });
 router.post(`/custody/:code/${purpose}/confirmar`,authorize('lab.custody'),async(req,res,next)=>{
  try{res.json(await confirmLabCustody(pool,req.params.code,purpose,req.body,req.user));}catch(e){sendPhysicalScanError(res,e,next);}
 });
}


function sendPhysicalScanError(res, error, next) {
  if (error instanceof ScanError || error instanceof FlowError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  return next(error);
}

// ==========================================
// 1. LISTAR TÉCNICOS
// ==========================================
router.get("/technicians", authorize('lab.read'), async (req, res, next) => {
  try {
    const sql = `
      SELECT id, nombre, apellido, correo as email 
      FROM pmp.usuarios 
      WHERE rol = 'tecnico_laboratorio' 
      AND activo = true
      ORDER BY nombre ASC
    `;
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. ASIGNAR TÉCNICO
// ==========================================
router.put("/assign", authorize('lab.assign'), async (req, res, next) => {
  const { codigo_os, tecnico_id } = req.body;
  try {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await requireLatestPhysicalScan(client,{codigoOs:codigo_os,station:'LABORATORIO'});
        const eligible=await client.query(`SELECT o.codigo_os FROM pmp.ordenes_servicio o WHERE o.codigo_os=$1 AND ${labAvailableSql()}`,[codigo_os]);
        if(!eligible.rowCount)throw new ScanError(409,'LAB_RECEIPT_REQUIRED','Confirma la recepción física en Laboratorio antes de asignar');
        let uuidFinal = null;
        if (tecnico_id && tecnico_id !== "0" && tecnico_id.trim() !== "") {
            uuidFinal = tecnico_id;
            await requireActiveUserRole(client,uuidFinal,'tecnico_laboratorio','El técnico');
        }
        
        const sql = `
          UPDATE pmp.ordenes_servicio 
          SET tecnico_laboratorio_id = $1, actualizado_en = NOW()
          WHERE codigo_os = $2
          RETURNING *
        `;
        const result = await client.query(sql, [uuidFinal, codigo_os]);

        if (result.rowCount === 0) return res.status(404).json({ error: `OS no encontrada` });
        
        await addFlowEvent(client,{os:codigo_os,type:'TECNICO_LABORATORIO_ASIGNADO',user:req.user,
          comment:uuidFinal?'Técnico de Laboratorio asignado.':'Asignación de Laboratorio retirada.',metadata:{tecnico_laboratorio_id:uuidFinal}});
        await client.query('COMMIT');
        res.json({ success: true, message: `Asignación actualizada` });
    } catch(err) { await client.query("ROLLBACK"); throw err; } finally {
        client.release();
    }
  } catch (err) {
    return sendPhysicalScanError(res,err,next);
  }
});

// ==========================================
// 3. OBTENER COLA DE TRABAJO
// ==========================================
router.get("/queue/:type", authorize('lab.read'), async (req, res, next) => {
  const { type } = req.params; 
  try {
    const assignedScope = req.user.rol === ROLES.TECNICO_LAB
      ? "AND o.tecnico_laboratorio_id = $2"
      : "";
    // 4=Diagnóstico, 5=Reparación, 9=Espera Repuesto
    const sql = `
      SELECT 
        o.codigo_os,
        o.tipo_equipo,
        o.fecha,
        caso.codigo_caso AS referencia_ar,
        ingreso.legacy AS ingreso_legacy, ingreso.en_transito AS en_transito_laboratorio,
        ingreso.fecha AS fecha_ingreso_laboratorio,
        ingreso.fuente AS fuente_ingreso_laboratorio,
        COALESCE(ingreso.reingreso,false) AS reingreso_laboratorio,
        COALESCE(v.modelo,c.modelo) AS modelo,
        COALESCE(v.marca,c.marca) AS marca,
        COALESCE(t.nombre,ct.nombre) AS terminal,
        COALESCE(p.nombre,cp.nombre) AS operador,
        concat_ws(' ',tl.nombre,tl.apellido) AS tecnico_laboratorio,
        ub.nombre AS ubicacion,
        o.falla, 
        o.estado_id,
        e.nombre as estado_nombre,
        o.bus_ppu, 
        COALESCE(o.validador_serie, o.consola_serie) as serie,
        u.nombre || ' ' || u.apellido as tecnico_origen,
        o.tecnico_laboratorio_id,
        (ingreso.fecha IS NOT NULL) AS recepcion_laboratorio_confirmada
      FROM pmp.ordenes_servicio o
      JOIN pmp.estados e ON o.estado_id = e.id
      LEFT JOIN pmp.casos_operacionales caso ON caso.id=o.caso_id
      LEFT JOIN pmp.usuarios u ON o.tecnico_terreno_id = u.id
      LEFT JOIN pmp.usuarios tl ON o.tecnico_laboratorio_id = tl.id
      LEFT JOIN pmp.validadores v ON o.tipo_equipo='VALIDADOR' AND v.serie=o.validador_serie
      LEFT JOIN pmp.consolas c ON o.tipo_equipo='CONSOLA' AND c.serie=o.consola_serie
      LEFT JOIN pmp.ubicaciones ub ON ub.id=o.ubicacion_id
      LEFT JOIN pmp.terminales t ON t.id=o.terminal_id LEFT JOIN pmp.terminales ct ON ct.id=caso.terminal_id
      LEFT JOIN pmp.pst p ON p.codigo=o.pst_codigo LEFT JOIN pmp.pst cp ON cp.codigo=caso.pst_codigo
      ${labArrivalJoin}
      LEFT JOIN LATERAL (
        SELECT estacion, tipo_equipo, serie
          FROM pmp.escaneos_equipos
         WHERE codigo_os = o.codigo_os
           AND resultado = 'VALIDADO'
         ORDER BY fecha DESC, id DESC
         LIMIT 1
      ) s ON TRUE
       WHERE o.tipo_equipo = $1
       AND o.estado_id IN (4, 5, 9) AND ${labAvailableSql()}
       ${assignedScope}
       ORDER BY o.estado_id DESC, o.fecha ASC
    `;
    const params = assignedScope ? [type.toUpperCase(), req.user.id] : [type.toUpperCase()];
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. MOVER DE ESTADO
// ==========================================
router.put("/move", authorize('lab.work'), async (req,res,next)=>{
 if(Number(req.body.nuevo_estado_id)!==5)return res.status(422).json({error:'INVALID_FLOW_ACTION'});
 try{res.json(await startWork(pool,req.body,req.user));}catch(e){sendPhysicalScanError(res,e,next);}
});
router.get("/work/:codigoOs",authorize('lab.work'),async(req,res,next)=>{
 try{res.json(await readWork(pool,req.params.codigoOs,req.user));}catch(e){sendPhysicalScanError(res,e,next);}
});
router.put("/work/:codigoOs",authorize('lab.work'),json({limit:'5mb'}),async(req,res,next)=>{
 try{res.json(await saveWork(pool,{...req.body,codigo_os:req.params.codigoOs},req.user));}catch(e){sendPhysicalScanError(res,e,next);}
});
router.post("/finish",authorize('lab.work'),json({limit:'5mb'}),async(req,res,next)=>{
 try{res.json(await finishWork(pool,req.body,req.user));}catch(e){sendPhysicalScanError(res,e,next);}
});
router.post("/request-part",authorize('lab.work'),async(req,res,next)=>{
 try{res.json(await requestPart(pool,req.body,req.user));}catch(e){sendPhysicalScanError(res,e,next);}
});

// ==========================================
// 7. CATÁLOGO
// ==========================================
router.get("/parts", authorize('warehouse.read'), async (req, res, next) => {
    try {
      const result = await pool.query(
          `SELECT id, nombre, categoria, stock FROM pmp.repuestos ORDER BY nombre ASC`
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
});
// ==========================================
// 8. OBTENER COMPLETADOS (ESTADO 10)
// ==========================================
router.get("/completed", authorize('lab.read'), async (req, res, next) => {
    try {
      const sql = `
        SELECT 
          o.codigo_os, 
          o.fecha,
          o.estado_id, e.nombre AS estado_nombre, o.tecnico_laboratorio_id,
          COALESCE(v.modelo,c.modelo) AS modelo,
        COALESCE(v.marca,c.marca) AS marca,
        COALESCE(t.nombre,ct.nombre) AS terminal,
        COALESCE(p.nombre,cp.nombre) AS operador, caso.codigo_caso AS referencia_ar,
          ingreso.fecha AS fecha_ingreso_laboratorio, ingreso.fuente AS fuente_ingreso_laboratorio,
          COALESCE(ingreso.reingreso,false) AS reingreso_laboratorio,
          o.falla, 
          o.tipo_equipo,
          o.bus_ppu, 
          COALESCE(o.validador_serie, o.consola_serie) as serie,
          u.nombre || ' ' || u.apellido as tecnico_laboratorio
        FROM pmp.ordenes_servicio o
        JOIN pmp.estados e ON e.id=o.estado_id
        LEFT JOIN pmp.validadores v ON o.tipo_equipo='VALIDADOR' AND v.serie=o.validador_serie
        LEFT JOIN pmp.consolas c ON o.tipo_equipo='CONSOLA' AND c.serie=o.consola_serie
        LEFT JOIN pmp.casos_operacionales caso ON caso.id=o.caso_id
        LEFT JOIN pmp.terminales t ON t.id=o.terminal_id LEFT JOIN pmp.terminales ct ON ct.id=caso.terminal_id
        LEFT JOIN pmp.pst p ON p.codigo=o.pst_codigo LEFT JOIN pmp.pst cp ON cp.codigo=caso.pst_codigo
        ${labArrivalJoin}
        LEFT JOIN pmp.usuarios u ON o.tecnico_laboratorio_id = u.id
        WHERE o.estado_id = 10 AND ${labAvailableSql()}
          ${req.user.rol === ROLES.TECNICO_LAB ? "AND o.tecnico_laboratorio_id = $1" : ""}
        ORDER BY o.actualizado_en DESC
      `;
      const result = await pool.query(sql, req.user.rol === ROLES.TECNICO_LAB ? [req.user.id] : []);
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
});

// ==========================================
// 9. DESPACHAR EQUIPOS REPARADOS A BODEGA
// ==========================================
// Retired bulk command: each outgoing asset needs its own, unconsumed evidence.
router.post("/dispatch-qa", authorize('lab.custody'), (req,res)=>res.status(410).json({error:'EXPLICIT_CUSTODY_REQUIRED',message:'Utiliza Despacho a Bodega y valida físicamente cada equipo antes de confirmar.'}));

export default router;
