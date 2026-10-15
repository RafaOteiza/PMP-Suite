import {authorize} from '../security/authorization.js';
import {qaCycleSql} from '../services/qaCustody.js';
import {deliverPart} from '../services/warehouseParts.js';
import { labTransitSql } from '../services/labArrival.js';
import { validateLabDispatch, confirmLabDispatch } from '../services/warehouseLabDispatch.js';
import { warehouseQueueSql } from '../services/warehouseQueue.js';
import { validateWarehouseReceipt, requireReceiptCustody } from '../services/warehouseReceipt.js';
import { Router } from "express";
import { pool } from "../db.js";
import { firebaseAuth } from "../middleware/firebaseAuth.js";
import { ensureUser } from "../middleware/ensureUser.js";
import { requireAnyRole } from "../middleware/requireAnyRole.js";
import { enforceReadOnlyRole } from "../middleware/readOnlyRole.js";
import { ROLES } from "../constants/roles.js";
import { ScanError, requireLatestPhysicalScan } from "../services/equipmentScan.js";
import { terrainDispatchSql, installationReadySql, logisticsStateSql, assignedWithoutDispatchSql, pendingTerrainSql } from '../services/logisticsPresentation.js';
import { addFlowEvent, sendFlowError, FlowError } from '../services/bridgeFlow.js';
import { requireWarehouseManualEvidence } from '../services/warehouseEvidence.js';
import { confirmWarehouseDispatch, validateWarehouseDispatch, dispatchDestinations } from '../services/warehouseDispatch.js';
import { initialAssetStockSql } from '../services/initialAssetStock.js';
import { readLogisticsInventory } from '../services/logisticsInventory.js';

const router = Router();

router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);

router.get('/inventario', authorize('warehouse.read'), async (req,res,next)=>{
  try { res.json(await readLogisticsInventory(pool,req.query)); }
  catch(error) { sendFlowError(res,error,next); }
});

function sendPhysicalScanError(res, error, next) {
  if (error instanceof ScanError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  return sendFlowError(res, error, next);
}

router.get('/despacho/destinos', authorize('warehouse.read'), async(req,res,next)=>{
  try{res.json(await dispatchDestinations(pool,req.query.q));}catch(e){next(e);}
});

router.post('/despacho/validar', authorize('warehouse.move'), async (req,res,next) => {
  try { return res.json(await validateWarehouseDispatch(pool,req.body,req.user)); }
  catch (error) { return sendPhysicalScanError(res,error,next); }
});

router.post('/despacho/confirmar', authorize('warehouse.move'), async (req,res,next) => {
  try { return res.status(201).json(await confirmWarehouseDispatch(pool,req.body,req.user)); }
  catch (error) { return sendPhysicalScanError(res,error,next); }
});

router.post('/recepcion-terreno/validar',authorize('warehouse.move'),async(req,res,next)=>{
  try { res.json(await validateWarehouseReceipt(pool,req.body,req.user)); }catch(e){sendPhysicalScanError(res,e,next);}
});

// ==========================================
// 1. OBTENER COLA DE BODEGA
// ==========================================
router.get("/queue", authorize('warehouse.read'), async (req, res, next) => {
  try {
    const sql = `
      SELECT
        o.codigo_os,
        o.fecha,
        o.falla,
        o.estado_id,
        e.nombre as estado_nombre,
        o.bus_ppu,
        COALESCE(o.validador_serie, o.consola_serie) as serie,
        o.tipo_equipo,
        COALESCE(v.modelo,console.modelo,ret.metadata->>'modelo') AS modelo,
        COALESCE(v.marca,console.marca,ret.metadata->>'marca') AS marca,
        COALESCE(ret.metadata->>'terminal',t.nombre,ct.nombre) AS terminal,
        COALESCE(ret.metadata->>'operador',p.nombre,cp.nombre) AS operador,
        COALESCE(ret.metadata->>'tecnico',NULLIF(concat_ws(' ',u.nombre,u.apellido),'')) AS tecnico_retiro,
        COALESCE(c.codigo_caso,ret.metadata->>'codigo_caso') AS codigo_caso,
        COALESCE(c.referencia_externa,ret.metadata->>'referencia_ar',o.ticket_aranda) AS referencia_ar,
        concat_ws(' ',labtech.nombre,labtech.apellido) AS tecnico_laboratorio,
        finished.metadata->'trabajo' AS trabajo_tecnico,
        o.es_aprobado_qa,
        CASE
          WHEN o.estado_id = 2                          THEN 'terreno'
          WHEN o.estado_id = 11 AND o.es_aprobado_qa = false THEN 'qa_rechazado'
          WHEN o.estado_id = 11 AND o.es_aprobado_qa = true THEN 'qa_aprobado'
          WHEN o.estado_id = 11                         THEN 'laboratorio'
          ELSE 'terreno'
        END as origen_transito,
        EXISTS (
          SELECT 1 FROM pmp.registro_reparaciones r WHERE r.codigo_os = o.codigo_os
        ) as fue_laboratorio
      FROM pmp.ordenes_servicio o
      JOIN pmp.estados e ON o.estado_id = e.id
      LEFT JOIN LATERAL (SELECT metadata FROM pmp.flujo_eventos WHERE codigo_os=o.codigo_os AND tipo='RETIRO_TERRENO_CONFIRMADO' ORDER BY id DESC LIMIT 1) ret ON true
      LEFT JOIN pmp.validadores v ON o.tipo_equipo='VALIDADOR' AND v.serie=o.validador_serie
      LEFT JOIN pmp.consolas console ON o.tipo_equipo='CONSOLA' AND console.serie=o.consola_serie
      LEFT JOIN pmp.casos_operacionales c ON c.id=o.caso_id
      LEFT JOIN pmp.terminales t ON t.id=o.terminal_id LEFT JOIN pmp.terminales ct ON ct.id=c.terminal_id
      LEFT JOIN pmp.pst p ON p.codigo=o.pst_codigo LEFT JOIN pmp.pst cp ON cp.codigo=c.pst_codigo
      LEFT JOIN pmp.usuarios u ON u.id=o.tecnico_terreno_id
      LEFT JOIN pmp.usuarios labtech ON labtech.id=o.tecnico_laboratorio_id
      LEFT JOIN LATERAL (SELECT metadata FROM pmp.flujo_eventos WHERE codigo_os=o.codigo_os AND tipo='LAB_REPARACION_FINALIZADA' ORDER BY id DESC LIMIT 1) finished ON true
      WHERE ${warehouseQueueSql()}
      ORDER BY o.fecha ASC
    `;
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Usuarios habilitados para recibir una asignación de control QA.
router.get("/qa-users", authorize('users.manage'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre, apellido
      FROM pmp.usuarios
      WHERE rol = 'qa' AND activo = TRUE
      ORDER BY nombre ASC, apellido ASC
    `);
    return res.json(result.rows);
  } catch (err) {
    return next(err);
  }
});


// ==========================================
// 2. RECIBIR EQUIPO EN BODEGA
// ==========================================
router.put("/receive", authorize('warehouse.move'), async (req, res, next) => {
  const { codigo_os } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // SELECT FOR UPDATE: bloquea la fila mientras dura la transacción.
    // Cualquier otra transacción concurrente esperará aquí hasta que termine la primera.
    const check = await client.query(`
      SELECT o.*,${labTransitSql()} AS transito_laboratorio,${pendingTerrainSql()} AS retiro_pendiente
      FROM pmp.ordenes_servicio o
      WHERE codigo_os = $1
      FOR UPDATE
    `, [codigo_os]);

    if (check.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "OS no encontrada" });
    }

    const o = check.rows[0];
    // Equivalent retries are allowed only while the received custody remains current and
    // only for the same actor and explicit physical evidence, never just an OS number.
    if([3,13].includes(o.estado_id)&&(req.body.validacion_id||req.body.escaneo_id)){
      const prior=(await client.query(`SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo IN ('RECEPCION_QA_BODEGA','RECEPCION_TERRENO_BODEGA','RECEPCION_LABORATORIO_BODEGA') AND usuario_id=$2
        AND metadata->>'validacion_id' IS NOT DISTINCT FROM $3 AND metadata->>'escaneo_id' IS NOT DISTINCT FROM $4
        AND id>(SELECT COALESCE(max(id),0) FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo IN ('SALIDA_QA_BODEGA','RETIRO_TERRENO_CONFIRMADO','SALIDA_LABORATORIO_BODEGA'))`,
        [codigo_os,req.user.id,req.body.validacion_id?String(req.body.validacion_id):null,req.body.escaneo_id?String(req.body.escaneo_id):null])).rowCount;
      if(prior){await client.query('COMMIT');return res.json({success:true,duplicado:true});}
    }
    // For modern QA cycles, a verdict alone cannot prove exit or make stock available.
    if(o.estado_id===11&&o.es_aprobado_qa!==null){
      const cycle=(await client.query(`SELECT ${qaCycleSql()} id FROM pmp.ordenes_servicio o WHERE codigo_os=$1`,[codigo_os])).rows[0]?.id;
      const modern=(await client.query("SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='QA_DICTAMEN_CONFIRMADO' AND metadata->>'ciclo_qa'=$2",[codigo_os,String(cycle||'legacy')])).rowCount;
      if(modern&&!(await client.query("SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='SALIDA_QA_BODEGA' AND metadata->>'ciclo_qa'=$2 AND metadata->>'resultado'=$3",[codigo_os,String(cycle||'legacy'),o.es_aprobado_qa?'OPERATIVO':'RECHAZADO'])).rowCount)
        throw new FlowError(409,'QA_EXIT_REQUIRED','Confirma la salida física desde QA antes de recibir en Bodega');
    }
    if(o.transito_laboratorio)throw new FlowError(409,"LAB_RECEIPT_REQUIRED","El destino es Laboratorio; confirma la recepción en esa estación");

    // Guardia de idempotencia: solo procesar si el equipo está en tránsito hacia bodega.
    // Estados válidos para recepcionar: 2 (EN_TRANSITO desde Terreno), 11 (EN_TRAYECTO_BODEGA desde Lab/QA)
    if (o.retiro_pendiente) throw new FlowError(409,'WITHDRAWAL_REQUIRED','El técnico debe confirmar el retiro físico antes de recepcionar en Bodega');
    if (o.estado_id !== 2 && o.estado_id !== 11) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `OS ${codigo_os} ya fue recepcionada (estado actual: ${o.estado_id}). Operación ignorada.`
      });
    }

    let capture;
    if(req.body.validacion_id!=null){
      if(req.body.escaneo_id)throw new FlowError(422,'AMBIGUOUS_CAPTURE','Usa una única evidencia de captura');
      const evidence=await requireWarehouseManualEvidence(client,{id:req.body.validacion_id,user:req.user,context:o.estado_id===2?'RECEPCION_TERRENO':'RECEPCION_RETORNO',
        asset:{tipo_equipo:o.tipo_equipo,serie:o.validador_serie||o.consola_serie},os:codigo_os});
      capture={validacion_id:evidence.id,origen_captura:'MANUAL_AUTORIZADO'};
    }else{
      const evidence=await requireLatestPhysicalScan(client, { codigoOs: codigo_os, station: "BODEGA" });
      if(req.body.escaneo_id&&String(req.body.escaneo_id)!==String(evidence.escaneo_id))throw new FlowError(409,'STALE_PHYSICAL_CAPTURE','Valida nuevamente la lectura de recepción');
      capture={escaneo_id:evidence.escaneo_id,origen_captura:'SCANNER'};
    }

    await requireReceiptCustody(client,{order:o,user:req.user,scanId:capture.escaneo_id,manualId:capture.validacion_id});

    // QA closes the repair and leaves physical stock evidence on that OS.
    // An installation OS is created only by confirmed physical dispatch.
    if (o.es_aprobado_qa === true) {
      // 2a. Cerrar OS Original (Reparación Finalizada)
      await client.query(`
        UPDATE pmp.ordenes_servicio
        SET estado_id = 13, es_aprobado_qa = TRUE, ubicacion_id = 1, actualizado_en = NOW()
        WHERE codigo_os = $1
      `, [codigo_os]);

      await addFlowEvent(client, { os: codigo_os, type: 'RECEPCION_QA_BODEGA', user: req.user,
        metadata: { ...capture,tipo_equipo: o.tipo_equipo, serie: o.validador_serie || o.consola_serie, disponible_instalacion: true } });

      await client.query("COMMIT");
      return res.json({ success: true, message: "Equipo recibido. Reparación cerrada y activo disponible en Bodega; la OS IN se creará al confirmar el despacho." });
    }

    // Si no fue aprobada por QA o viene de terreno, simplemente entra a bodega
    await client.query(`
      UPDATE pmp.ordenes_servicio
      SET estado_id = 3, ubicacion_id = 1, es_aprobado_qa = CASE WHEN es_aprobado_qa IS FALSE THEN FALSE ELSE NULL END, actualizado_en = NOW()
      WHERE codigo_os = $1
    `, [codigo_os]);

    await addFlowEvent(client,{os:codigo_os,type:o.estado_id===2?'RECEPCION_TERRENO_BODEGA':o.es_aprobado_qa===false?'RECEPCION_QA_BODEGA':'RECEPCION_LABORATORIO_BODEGA',user:req.user,
      comment:`Origen de captura: ${capture.origen_captura}.`,metadata:{...capture,tipo_equipo:o.tipo_equipo,serie:o.validador_serie||o.consola_serie}});

    await client.query("COMMIT");
    res.json({ success: true, message: "Equipo recibido en Bodega" });
  } catch (err) {
    await client.query("ROLLBACK");
    return sendPhysicalScanError(res, err, next);
  } finally {
    client.release();
  }
});


// ==========================================
// 3. DESPACHAR A LABORATORIO
// ==========================================
router.post('/dispatch-lab/validar', authorize('warehouse.move'), async (req,res,next)=>{
 try {res.json(await validateLabDispatch(pool,req.body,req.user));}
 catch(error){return sendPhysicalScanError(res,error,next);}
});
router.put('/dispatch-lab', authorize('warehouse.move'), async (req,res,next)=>{
 try {res.json(await confirmLabDispatch(pool,req.body,req.user));}
 catch(error){return sendPhysicalScanError(res,error,next);}
});

// ==========================================
// 4. DESPACHAR A QA
// ==========================================
router.put("/dispatch-qa", authorize('warehouse.move'), async (req, res, next) => {
  try {res.json(await confirmLabDispatch(pool,req.body,req.user,'QA'));}
  catch(error){return sendPhysicalScanError(res,error,next);}
});
router.post('/dispatch-qa/validar',authorize('warehouse.move'),async(req,res,next)=>{
 try {res.json(await validateLabDispatch(pool,req.body,req.user,'QA'));}
 catch(error){return sendPhysicalScanError(res,error,next);}
});

// ==========================================
// 5. OBTENER STOCK Y EQUIPOS DISPONIBLES
// ==========================================
router.get("/stock", authorize('warehouse.read'), async (req, res, next) => {
  try {
    // 1. Equipos listos para instalar (Estado 7 = DISPONIBLE)
    const sqlListos = `
      SELECT
        o.codigo_os,
        o.fecha,
        o.falla,
        o.estado_id,
        ${logisticsStateSql()} as estado_nombre,
        o.bus_ppu,
        COALESCE(o.validador_serie, o.consola_serie) as serie,
        COALESCE(v.modelo,c.modelo) AS modelo,COALESCE(v.marca,c.marca) AS marca,
        o.tipo_equipo, o.es_instalacion, o.es_aprobado_qa,
        COALESCE(s.estacion = 'BODEGA' AND s.tipo_equipo = o.tipo_equipo
          AND s.serie = COALESCE(o.validador_serie,o.consola_serie) AND s.metadata->>'contexto'='DESPACHO_TERRENO',FALSE) AS escaneado_bodega
      FROM pmp.ordenes_servicio o
      JOIN pmp.estados e ON o.estado_id = e.id
      LEFT JOIN pmp.validadores v ON v.serie=o.validador_serie AND o.tipo_equipo='VALIDADOR'
      LEFT JOIN pmp.consolas c ON c.serie=o.consola_serie AND o.tipo_equipo='CONSOLA'
      LEFT JOIN LATERAL (
        SELECT estacion,tipo_equipo,serie,metadata FROM pmp.escaneos_equipos
        WHERE codigo_os=o.codigo_os AND resultado='VALIDADO'
        ORDER BY fecha DESC,id DESC LIMIT 1
      ) s ON TRUE
      WHERE ${installationReadySql()}
      ORDER BY o.fecha DESC
    `;
    const resultListos = await pool.query(sqlListos);
    const initialListos = await pool.query(initialAssetStockSql);

    // 2. Inventario físico global en base de datos
    const resultVali = await pool.query("SELECT COUNT(*) FROM pmp.validadores");
    const resultCons = await pool.query("SELECT COUNT(*) FROM pmp.consolas");

    res.json({
        listos: [...resultListos.rows,...initialListos.rows],
        inventario: {
            validadores: parseInt(resultVali.rows[0].count, 10),
            consolas: parseInt(resultCons.rows[0].count, 10),
            total: parseInt(resultVali.rows[0].count, 10) + parseInt(resultCons.rows[0].count, 10)
        }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 6. INVENTARIO DE REPUESTOS
// ==========================================
router.get("/repuestos", authorize('warehouse.read'), async (req, res, next) => {
  try {
    // Inventario de repuestos
    const sqlRepuestos = `
      SELECT
        r.id,
        r.nombre,
        r.categoria,
        r.stock,
        r.stock_critico,
        (r.stock - COALESCE(r.stock_critico, 0)) as diferencia
      FROM pmp.repuestos r
      ORDER BY r.categoria, r.nombre
    `;

    // Solicitudes pendientes de repuestos
    const sqlSolicitudes = `
      SELECT
        sr.id,
        sr.codigo_os,
        sr.estado,
        sr.fecha_solicitud, sr.repuesto_solicitado, sr.comentario,
        concat_ws(' ',solicitante.nombre,solicitante.apellido) AS tecnico,
        o.tipo_equipo,COALESCE(o.validador_serie,o.consola_serie) AS serie
      FROM pmp.solicitudes_repuestos sr
      LEFT JOIN pmp.usuarios solicitante ON solicitante.id=sr.solicitado_por
      JOIN pmp.ordenes_servicio o ON o.codigo_os=sr.codigo_os
      WHERE sr.estado NOT IN ('DESPACHADA', 'RECHAZADA')
      ORDER BY sr.fecha_solicitud DESC
      LIMIT 20
    `;

    const [resRep, resSolic] = await Promise.all([
        pool.query(sqlRepuestos),
        pool.query(sqlSolicitudes)
    ]);

    res.json({
        repuestos: resRep.rows,
        solicitudes: resSolic.rows
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 7. ACTUALIZAR STOCK REPUESTO
// ==========================================
// Catalog editing is not an inventory movement. Adjustment policy remains undefined.
router.put("/repuestos/:id/stock", authorize('warehouse.move'), (req,res)=>res.status(409).json({error:'STOCK_ADJUSTMENT_POLICY_REQUIRED',message:'No se permite sobrescribir existencias. Las entregas se registran desde su solicitud; los ajustes requieren una política de inventario autorizada.'}));

// ==========================================
// 8. ENTREGAR RESPUESTO (SOLICITUD)
// ==========================================
router.put("/solicitudes/:id/entregar", authorize('warehouse.move'), async (req,res,next)=>{
 try{res.json(await deliverPart(pool,req.params.id,req.body||{},req.user));}catch(e){sendFlowError(res,e,next);}
});

// ==========================================
// 9. OBTENER TÉCNICOS DE TERRENO
// ==========================================
router.get("/tecnicos", authorize('warehouse.read'), async (req, res, next) => {
  try {
    const r = await pool.query("SELECT id, nombre, apellido FROM pmp.usuarios WHERE rol = 'tecnico_terreno' AND activo = true");
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 10. ASIGNAR EQUIPO A TERRENO
// ==========================================
router.put("/asignar",authorize('warehouse.move'),(req,res)=>res.status(410).json({error:'PHYSICAL_DISPATCH_REQUIRED',message:'Utiliza Despacho por escaneo para confirmar una instalación con evidencia y contexto completos.'}));

// ==========================================
// 11. KPI DASHBOARD BODEGA
// ==========================================
router.get("/dashboard", authorize('warehouse.read'), async (req, res, next) => {
  try {
    const rep_criticos = await pool.query("SELECT COUNT(*) FROM pmp.repuestos WHERE stock <= COALESCE(stock_critico, 0)");

    const tickets = await pool.query(`
      SELECT name,estado_id,COUNT(*) AS value FROM (
        SELECT ${logisticsStateSql()} AS name,o.estado_id FROM pmp.ordenes_servicio o
        JOIN pmp.estados e ON e.id=o.estado_id WHERE o.estado_id NOT IN (8,12,13)
      ) classified GROUP BY name,estado_id ORDER BY estado_id,name
    `);

    const movimiento = await pool.query(`SELECT
      COUNT(DISTINCT (o.tipo_equipo,COALESCE(o.validador_serie,o.consola_serie))) FILTER (WHERE ${terrainDispatchSql()}) AS en_ruta,
      COUNT(DISTINCT (o.tipo_equipo,COALESCE(o.validador_serie,o.consola_serie))) FILTER (
        WHERE ${assignedWithoutDispatchSql()}) AS asignados
      FROM pmp.ordenes_servicio o`);

    res.json({
        alertasStock: parseInt(rep_criticos.rows[0].count, 10),
        // This distribution counts real active OS only. Initial stock belongs to /stock.
        distribucionEstados: tickets.rows.map(r => ({ name: r.name, value: parseInt(r.value, 10), estado_id: r.estado_id })),
        equiposEnRuta: Number(movimiento.rows[0].en_ruta),
        equiposAsignados: Number(movimiento.rows[0].asignados)
    });
  } catch (err) {
    next(err);
  }
});

export default router;
