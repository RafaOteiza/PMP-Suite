import {authorize} from '../security/authorization.js';
import {searchRequirementAssets} from '../services/requirementSearch.js';
import { requireVacantInstallation } from '../services/warehouseDispatch.js';
import { labTransitSql } from '../services/labArrival.js';
import { Router, json } from "express";
import { pool } from "../db.js";
import { firebaseAuth } from "../middleware/firebaseAuth.js";
import { ensureUser } from "../middleware/ensureUser.js";
import { requireAnyRole } from "../middleware/requireAnyRole.js";
import { enforceReadOnlyRole } from "../middleware/readOnlyRole.js";
// import { changeState } from "../services/osStateMachine.js"; // Comentado si no tienes este archivo aun
import { ROLES } from "../constants/roles.js";
import { createCaseWithClient, correlateCaseOrder, requirementInput } from '../services/requirements.js';
import { requireOperationalAsset } from '../services/assetManagement.js';
import { logisticsStateSql, terrainDispatchSql, pendingTerrainSql } from '../services/logisticsPresentation.js';
import { assignTerrainWithdrawal, confirmTerrainWithdrawal, validateTerrainIdentity, registerWithdrawalDiscrepancy } from '../services/terrainWithdrawal.js';
import { listPendingWithdrawals } from '../services/terrainWithdrawalRead.js';
import { FlowError, addFlowEvent, sendFlowError, withTransaction } from '../services/bridgeFlow.js';
import {
  ScanError,
  expectedSeriesForAmid,
  isValidUpcA,
  normalizeScannedCode
} from "../services/equipmentScan.js";

const router = Router();

router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);

// Same operational lookup used by requirement entry; no custody mutation.
router.get('/activos-operativos',authorize('terrain.work'),async(req,res,next)=>{
 try{res.json(await searchRequirementAssets(pool,req.query));}catch(e){sendFlowError(res,e,next);}
});

router.get('/pendientes-retiro',authorize('terrain.assign.read'),async(req,res,next)=>{
  try { res.json(await listPendingWithdrawals(pool)); }
  catch(e){sendFlowError(res,e,next);}
});
router.post('/asignar-retiro',authorize('terrain.assign'),async(req,res,next)=>{
  try { res.json(await assignTerrainWithdrawal(pool,req.body,req.user)); }catch(e){sendFlowError(res,e,next);}
});
router.post('/validar-identidad-retiro',authorize('terrain.work'),async(req,res,next)=>{
  try{res.json(await validateTerrainIdentity(pool,req.body,req.user));}catch(e){sendFlowError(res,e,next);}
});
router.post('/discrepancia-retiro',authorize('terrain.work'),async(req,res,next)=>{
  try{res.json(await registerWithdrawalDiscrepancy(pool,req.body,req.user));}catch(e){sendFlowError(res,e,next);}
});
router.post('/confirmar-retiro',authorize('terrain.work'),json({limit:'5mb'}),async(req,res,next)=>{
  try { res.json(await confirmTerrainWithdrawal(pool,req.body,req.user)); }catch(e){sendFlowError(res,e,next);}
});

/**
 * GET /api/os
 * Listado global de ordenes de servicio para administracion y gerencia.
 */
router.get("/", authorize('orders.list'), async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const tipoEquipo = typeof req.query.tipo_equipo === "string"
      ? req.query.tipo_equipo.trim().toUpperCase()
      : "";
    const groupFilters={activas:'o.estado_id NOT IN (8,12,13)',cerradas:'o.estado_id IN (8,12,13)',pod:'o.es_pod IS TRUE',fallas:'o.es_instalacion IS NOT TRUE',instalaciones:'o.es_instalacion IS TRUE AND o.estado_id NOT IN (8,12,13)',retiros:pendingTerrainSql()};
    const grupo=req.query.grupo??'';
    if(typeof grupo!=='string'||(grupo&&!Object.hasOwn(groupFilters,grupo)))return res.status(400).json({error:'grupo invalido'});
    const estadoIdRaw = req.query.estado_id;
    const estadoIdText = estadoIdRaw === undefined ? "" : String(estadoIdRaw).trim();
    const estadoId = estadoIdRaw === undefined ? null : Number(estadoIdText);
    const limitText = String(req.query.limit ?? "50").trim();
    const offsetText = String(req.query.offset ?? "0").trim();

    if (q.length > 100) {
      return res.status(400).json({ error: "q excede el maximo de 100 caracteres" });
    }
    if (tipoEquipo && !["CONSOLA", "VALIDADOR"].includes(tipoEquipo)) {
      return res.status(400).json({ error: "tipo_equipo invalido" });
    }
    if (estadoIdRaw !== undefined && (!/^\d+$/.test(estadoIdText) || !Number.isSafeInteger(estadoId) || estadoId < 1)) {
      return res.status(400).json({ error: "estado_id invalido" });
    }
    const requestedLimit = Number(limitText);
    const requestedOffset = Number(offsetText);
    if (!/^\d+$/.test(limitText) || !Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
      return res.status(400).json({ error: "limit invalido" });
    }
    if (!/^\d+$/.test(offsetText) || !Number.isSafeInteger(requestedOffset)) {
      return res.status(400).json({ error: "offset invalido" });
    }

    const limit = Math.min(requestedLimit, 100);
    const offset = requestedOffset;

    const filters = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      filters.push(`(
        o.codigo_os ILIKE $${params.length}
        OR COALESCE(o.ticket_aranda, '') ILIKE $${params.length}
        OR COALESCE(o.bus_ppu, '') ILIKE $${params.length}
        OR COALESCE(o.validador_serie, o.consola_serie, '') ILIKE $${params.length}
      )`);
    }
    if (tipoEquipo) {
      params.push(tipoEquipo);
      filters.push(`o.tipo_equipo = $${params.length}`);
    }
    if(grupo)filters.push('('+groupFilters[grupo]+')');
    if (estadoId !== null) {
      params.push(estadoId);
      filters.push(`o.estado_id = $${params.length}`);
    }

    params.push(limit, offset);
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const sql = `
      WITH filtered AS (
        SELECT
          o.codigo_os,
          o.fecha,
          o.actualizado_en,
          o.tipo_equipo,
          o.falla,
          o.bus_ppu,
          o.ticket_aranda,
          o.estado_id,
          ${logisticsStateSql()} AS estado_nombre,
          o.ubicacion_id,
          CASE WHEN ${labTransitSql()} THEN 'En tránsito hacia Laboratorio' ELSE ub.nombre END AS ubicacion_nombre,
          COALESCE(o.validador_serie, o.consola_serie) AS serie,
          COALESCE(v.modelo,con.modelo) AS modelo, COALESCE(v.marca,con.marca) AS marca,
          NULLIF(CONCAT_WS(' ', terreno.nombre, terreno.apellido), '') AS tecnico_terreno,
          NULLIF(CONCAT_WS(' ', laboratorio.nombre, laboratorio.apellido), '') AS tecnico_laboratorio
        FROM pmp.ordenes_servicio o
        JOIN pmp.estados e ON e.id = o.estado_id
        LEFT JOIN pmp.validadores v ON o.tipo_equipo='VALIDADOR' AND v.serie=o.validador_serie
        LEFT JOIN pmp.consolas con ON o.tipo_equipo='CONSOLA' AND con.serie=o.consola_serie
        LEFT JOIN pmp.ubicaciones ub ON ub.id = o.ubicacion_id
        LEFT JOIN pmp.usuarios terreno ON terreno.id = o.tecnico_terreno_id
        LEFT JOIN pmp.usuarios laboratorio ON laboratorio.id = o.tecnico_laboratorio_id
        ${where}
      ),
      paged AS (
        SELECT *
        FROM filtered
        ORDER BY fecha DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      )
      SELECT
        COALESCE(json_agg(paged ORDER BY fecha DESC), '[]'::json) AS items,
        (SELECT COUNT(*)::int FROM filtered) AS total
      FROM paged
    `;

    const { rows } = await pool.query(sql, params);
    const items = Array.isArray(rows[0]?.items) ? rows[0].items : [];
    const total = Number.parseInt(rows[0]?.total ?? 0, 10);

    return res.json({ items, pagination: { total, limit, offset } });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/os/crear
 * Crea una nueva Orden de Servicio en pmp.ordenes_servicio
 */
router.post("/crear", authorize('terrain.work'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { 
        tipo,           // "CONSOLA" o "VALIDADOR"
        es_pod, 
        falla, 
        bus_ppu, 
        serie_equipo, 
        modelo, 
        marca,
        // Nuevos campos requeridos por la DB:
        terminal_id,    
        pst_codigo,
        ticket_aranda,
        amid
    } = req.body;

    // 1. Validaciones básicas
    if (!["CONSOLA", "VALIDADOR"].includes(tipo)) {
      return res.status(400).json({ error: "tipo debe ser CONSOLA o VALIDADOR" });
    }
    if (!bus_ppu || !serie_equipo || !falla) {
      return res.status(400).json({ error: "Faltan datos obligatorios (ppu, serie, falla)" });
    }

    const serieNormalizada = normalizeScannedCode(String(serie_equipo));
    const amidNormalizado = amid === undefined || amid === null || String(amid).trim() === ""
      ? null
      : normalizeScannedCode(String(amid));

    if (tipo === "CONSOLA" && amidNormalizado) {
      return res.status(422).json({ error: "AMID_NOT_ALLOWED_FOR_CONSOLE", message: "Las consolas se identifican por su serie" });
    }
    if (tipo === "VALIDADOR" && amidNormalizado) {
      if (!isValidUpcA(amidNormalizado)) {
        return res.status(422).json({ error: "INVALID_AMID_CHECK_DIGIT", message: "El AMID posee un dígito verificador inválido" });
      }
      const expectedSeries = expectedSeriesForAmid(amidNormalizado);
      if (expectedSeries && expectedSeries !== serieNormalizada) {
        return res.status(409).json({
          error: "AMID_SERIES_MISMATCH",
          message: `El AMID corresponde a la serie ${expectedSeries}, no a ${serieNormalizada}`
        });
      }
    }

    await client.query("BEGIN");

    // Reporting a fault never creates or edits the asset master.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${tipo}|${serieNormalizada}`]);
    await requireOperationalAsset(client,tipo,serieNormalizada,String(bus_ppu).trim().toUpperCase());
    if((await client.query(`SELECT 1 FROM pmp.ordenes_servicio WHERE tipo_equipo=$1
      AND COALESCE(validador_serie,consola_serie)=$2 AND estado_id NOT IN (8,12,13)`,[tipo,serieNormalizada])).rowCount)
      throw new FlowError(409,'ASSET_ACTIVE_ORDER','El activo ya tiene una intervención pendiente o en curso');

    // 4. Determinar columnas dinámicas según tipo
    const colSerie = tipo === "CONSOLA" ? "consola_serie" : "validador_serie";
    
    const matches=await searchRequirementAssets(client,{tipo_equipo:tipo,serie_exacta:serieNormalizada,bus_ppu:String(bus_ppu).trim().toUpperCase(),bus_exacto:true});
    const installation=matches.items[0];
    if(!installation?.terminal_id||!installation?.pst_codigo)throw new FlowError(409,'INSTALLATION_CONTEXT_MISSING','La instalación vigente no tiene terminal u operador resuelto. Requiere revisión.');
    if((terminal_id!=null&&String(terminal_id)!==String(installation.terminal_id))||(pst_codigo!=null&&pst_codigo!==installation.pst_codigo))
      throw new FlowError(409,'INSTALLATION_CONTEXT_MISMATCH','Terminal u operador no coinciden con la instalación vigente');
    const terminalIdFinal=installation.terminal_id,pstCodigoFinal=installation.pst_codigo;
    const caso = await createCaseWithClient(client, requirementInput({
      origen: ticket_aranda ? 'ARANDA' : 'INTERNO', referencia_externa: ticket_aranda,
      tipo_equipo: tipo, serie: serieNormalizada, bus_ppu,
      terminal_id: terminalIdFinal, pst_codigo: pstCodigoFinal, falla,
      clasificacion: es_pod ? 'POD' : 'MANTENCION', fecha_requerimiento: new Date().toISOString()
    }), req.user);
    
    // Assigned field task; no physical withdrawal has occurred yet.
    const estadoInicialId = 1;

    // 5. Insertar la OS (El Trigger generará el codigo_os automáticamente)
    const insertQuery = `
      INSERT INTO pmp.ordenes_servicio (
        tipo_equipo, 
        es_pod, 
        falla,
        bus_ppu, 
        ${colSerie}, 
        estado_id,
        terminal_id,
        pst_codigo,
        tecnico_terreno_id,
        ticket_aranda,
        caso_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;

    const values = [
        tipo, 
        es_pod || false, 
        falla, 
        bus_ppu, 
        serieNormalizada,
        estadoInicialId,
        terminalIdFinal,
        pstCodigoFinal,
        req.user.id, // ID del usuario logueado (UUID)
        null,
        caso.id
    ];

    const { rows } = await client.query(insertQuery, values);
    const nuevaOS = rows[0];
    await correlateCaseOrder(client,caso,nuevaOS,req.user);
    await addFlowEvent(client,{os:nuevaOS.codigo_os,type:'REQUERIMIENTO_INGRESADO',user:req.user,
      metadata:{caso_id:caso.id,pendiente_retiro:true}});

    await client.query("COMMIT");
    
    res.status(201).json({ 
        message: "Orden de Servicio creada exitosamente",
        os: nuevaOS 
    });

  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Error creando OS:", e);
    if (e instanceof ScanError || e instanceof FlowError) {
      return res.status(e.status).json({ error: e.code, message: e.message });
    }
    if (e.code === "23505" && e.constraint === "uq_validadores_amid") {
      return res.status(409).json({ error: "AMID_ALREADY_ASSIGNED", message: "El AMID ya está asociado a otro validador" });
    }
    if (e.code === '23505') return res.status(409).json({ error:'REQUIREMENT_EXISTS', message:'El requerimiento o código de OS ya existe; consulta su caso.' });
    // Manejo de error específico del trigger de validación
    if (e.message && e.message.includes("Operador") && e.message.includes("no autorizado")) {
        return res.status(409).json({ error: e.message }); // 409 Conflict
    }
    next(e);
  } finally {
    client.release();
  }
});

/**
 * POST /api/os/completar-instalacion
 * Procesa el resultado de una instalación en bus
 */
router.post("/completar-instalacion", authorize('terrain.work'), async (req, res, next) => {
  const { codigo_os, operativo, comentario, bus_ppu } = req.body;
  try {
    if (typeof operativo !== 'boolean') throw new FlowError(422,'INVALID_INSTALLATION_RESULT','Indica si la instalación quedó operativa');
    const os = await withTransaction(pool, async client => {
      const current = await client.query(`SELECT o.* FROM pmp.ordenes_servicio o
        WHERE o.codigo_os=$1 AND o.tecnico_terreno_id=$2 AND o.es_instalacion IS TRUE
          AND ${terrainDispatchSql()} FOR UPDATE OF o`, [codigo_os,req.user.id]);
      if (!current.rowCount) throw new FlowError(409,'INSTALLATION_NOT_ASSIGNED',
        'La instalación no está asignada al técnico o no tiene un despacho físico vigente');
      const order = current.rows[0];
      if (bus_ppu && String(bus_ppu).trim().toUpperCase() !== order.bus_ppu) {
        throw new FlowError(409,'INSTALLATION_BUS_MISMATCH','El bus debe coincidir con el destino confirmado por Logística');
      }
      if(operativo&&(await client.query("SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='SALIDA_BODEGA_TERRENO' AND metadata->>'contexto_instalacion'='NUEVA'",[codigo_os])).rowCount)
        await requireVacantInstallation(client,order.tipo_equipo,order.bus_ppu,order.validador_serie||order.consola_serie);
      const updated = await client.query(`UPDATE pmp.ordenes_servicio
        SET estado_id=$2,actualizado_en=now() WHERE codigo_os=$1 RETURNING *`, [codigo_os,operativo ? 13 : 11]);
      await addFlowEvent(client, { os: codigo_os, type: operativo ? 'INSTALACION_COMPLETADA' : 'INSTALACION_FALLIDA',
        user: req.user, comment: typeof comentario === 'string' ? comentario.trim() : null,
        metadata: { caso_id: order.caso_id, os_origen: order.os_origen, bus_ppu: order.bus_ppu,
          terminal_id: order.terminal_id, tecnico_terreno_id: order.tecnico_terreno_id,
          tipo_equipo: order.tipo_equipo, serie: order.validador_serie || order.consola_serie } });
      return updated.rows[0];
    });
    res.json({ 
        success: true, 
        message: operativo ? "Instalación completada exitosamente" : "Equipo reportado con falla, en retorno a bodega",
        os
    });
  } catch (err) {
    sendFlowError(res,err,next);
  }
});

/**
 * GET /api/os/mis-ordenes
 * Lista las OS asociadas al técnico de terreno autenticado
 */
router.get("/mis-ordenes", authorize('orders.read'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT 
        o.codigo_os, 
        o.tipo_equipo, 
        o.falla, 
        o.estado_id, 
        ${logisticsStateSql()} as estado_nombre,
        o.fecha,
        o.bus_ppu,o.es_instalacion,o.caso_id,o.os_origen,
        c.codigo_caso,c.origen,c.referencia_externa,t.nombre AS terminal,p.nombre AS operador,COALESCE(v.modelo,con.modelo) AS modelo,COALESCE(v.marca,con.marca) AS marca,
        concat_ws(' ',tecnico.nombre,tecnico.apellido) AS tecnico_nombre,
        COALESCE(o.validador_serie, o.consola_serie) as serie
      FROM pmp.ordenes_servicio o
      JOIN pmp.estados e ON o.estado_id = e.id
      LEFT JOIN pmp.casos_operacionales c ON c.id=o.caso_id
      LEFT JOIN pmp.terminales t ON t.id=o.terminal_id
      LEFT JOIN pmp.pst p ON p.codigo=o.pst_codigo
      LEFT JOIN pmp.validadores v ON v.serie=o.validador_serie
      LEFT JOIN pmp.consolas con ON con.serie=o.consola_serie
      LEFT JOIN pmp.usuarios tecnico ON tecnico.id=o.tecnico_terreno_id
      WHERE o.tecnico_terreno_id = $1
        AND (${pendingTerrainSql()} OR o.codigo_os IN (
          SELECT recent.codigo_os FROM pmp.ordenes_servicio recent
          WHERE recent.tecnico_terreno_id=$1 ORDER BY recent.fecha DESC,recent.codigo_os DESC LIMIT 20
        ))
      ORDER BY o.fecha DESC
    `;
    const { rows } = await pool.query(sql, [userId]);
    const pending=await listPendingWithdrawals(pool,{technicianId:userId});
    const context=new Map(pending.map(o=>[o.codigo_os,o]));
    res.json(rows.map(o=>({...o,...(context.get(o.codigo_os)||{})})));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/os/:id
 * Obtiene el detalle de una OS por su código (ej: MC-000001)
 */
router.get("/:id", authorize('orders.read'), async (req, res, next) => {
  try {
    const { id } = req.params; // Esto es el codigo_os (string)

    const sql = `
        SELECT 
            o.*, 
            ${logisticsStateSql()} as estado_nombre,
            u.nombre || ' ' || u.apellido as tecnico_nombre,
            c.codigo_caso,c.origen,c.referencia_externa,t.nombre AS terminal,p.nombre AS operador,
            COALESCE(o.validador_serie,o.consola_serie) AS serie,COALESCE(v.modelo,con.modelo) AS modelo,COALESCE(v.marca,con.marca) AS marca
        FROM pmp.ordenes_servicio o
        JOIN pmp.estados e ON o.estado_id = e.id
        LEFT JOIN pmp.usuarios u ON o.tecnico_terreno_id = u.id
        LEFT JOIN pmp.casos_operacionales c ON c.id=o.caso_id
        LEFT JOIN pmp.terminales t ON t.id=o.terminal_id
        LEFT JOIN pmp.pst p ON p.codigo=o.pst_codigo
        LEFT JOIN pmp.validadores v ON o.tipo_equipo='VALIDADOR' AND v.serie=o.validador_serie
        LEFT JOIN pmp.consolas con ON o.tipo_equipo='CONSOLA' AND con.serie=o.consola_serie
        WHERE o.codigo_os = $1
    `;
    
    const { rows } = await pool.query(sql, [id]);

    if (rows.length === 0) return res.status(404).json({ error: "OS no encontrada" });
    const selected=rows[0];
    if((req.user.rol===ROLES.TECNICO_TERRENO&&String(selected.tecnico_terreno_id)!==String(req.user.id))||
       (req.user.rol===ROLES.TECNICO_LAB&&String(selected.tecnico_laboratorio_id)!==String(req.user.id)))
      return res.status(403).json({error:'ORDER_NOT_ASSIGNED',message:'La OS no pertenece a tu carga operacional'});

    if(req.user.rol===ROLES.TECNICO_TERRENO) {
      // Keep the assigned-task contract; never expose the full administrative row
      // as an alternate route around the technical-history projection.
      const fields=['codigo_os','tipo_equipo','serie','modelo','marca','falla','fecha','estado_id','estado_nombre',
        'bus_ppu','terminal','operador','tecnico_nombre','es_instalacion','es_pod','codigo_caso','referencia_externa','os_origen'];
      return res.json(Object.fromEntries(fields.filter(field=>Object.hasOwn(selected,field)).map(field=>[field,selected[field]])));
    }
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;
