import {authorize} from '../security/authorization.js';
import {qaReceivedSql,qaStageSql} from '../services/qaCustody.js';
import {readExecutiveDashboard} from '../services/executiveDashboard.js';
import { labTransitSql,labAvailableSql } from '../services/labArrival.js';
import { searchAssets } from '../services/assetHistory.js';
import { sendFlowError } from '../services/bridgeFlow.js';
import { Router } from "express";
import { pool } from "../db.js";
import { firebaseAuth } from "../middleware/firebaseAuth.js";
import { ensureUser } from "../middleware/ensureUser.js";
import { requireAnyRole } from "../middleware/requireAnyRole.js";
import { enforceReadOnlyRole } from "../middleware/readOnlyRole.js";
import { ROLES } from "../constants/roles.js";
import { terrainDispatchSql, installationReadySql, operatingAssetsSql, assignedWithoutDispatchSql, pendingTerrainSql } from '../services/logisticsPresentation.js';
import { initialAssetStockSql } from '../services/initialAssetStock.js';

const router = Router();
router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);
router.get('/executive',authorize('supervision.read'),async(req,res,next)=>{
 try{res.json(await readExecutiveDashboard(pool));}catch(e){next(e);}
});

router.get("/summary", authorize('supervision.read'), async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
        // 2. OBTENER ORDENES DE SERVICIO ACTIVAS
        const osSql = `
          WITH activos_en_proceso AS (
            SELECT DISTINCT ON (tipo_equipo,COALESCE(validador_serie,consola_serie)) source.*,${labTransitSql('source')} AS transito_lab,${qaReceivedSql('source')} AS carga_qa,${qaStageSql('source')} AS etapa_qa,${labAvailableSql('source')} AS carga_lab,${pendingTerrainSql('source')} AS retiro_pendiente
            FROM pmp.ordenes_servicio source WHERE estado_id NOT IN (8,12,13)
            ORDER BY tipo_equipo,COALESCE(validador_serie,consola_serie),fecha DESC,codigo_os DESC
          ) SELECT
            o.tipo_equipo as tipo,
            o.estado_id,
            CASE WHEN o.retiro_pendiente THEN 'PENDIENTE_RETIRO' ELSE e.nombre END as estado_actual,
            o.retiro_pendiente,o.transito_lab,o.carga_lab,o.carga_qa,o.etapa_qa,
            o.es_pod,
            COUNT(*) as total
          FROM activos_en_proceso o
          JOIN pmp.estados e ON o.estado_id = e.id
          WHERE o.estado_id NOT IN (8, 12, 13)
          GROUP BY o.tipo_equipo, o.estado_id, e.nombre, o.es_pod, o.retiro_pendiente,o.transito_lab,o.carga_lab,o.carga_qa,o.etapa_qa
        `;

        const { rows: osRows } = await client.query(osSql);
        const ordenesActivas = Number((await client.query('SELECT count(*) FROM pmp.ordenes_servicio WHERE estado_id NOT IN (8,12,13)')).rows[0].count);

        // 3. PROCESAR METRICAS
        let conteoEnTaller = 0;
        let conteoDisponibles = 0;
        let conteoEnBodega = 0;
        let conteoEnTransito = 0;

        // Contadores específicos para subtítulos de Taller
        let consolasEnTaller = 0;
        let validadoresEnTaller = 0;

        let podsTotalesEnProceso = 0;
        let podsRecuperados = 0;

        osRows.forEach(r => {
            const { tipo, estado_id, es_pod, total } = r;
            const nTotal = parseInt(total, 10);
            const sId = parseInt(estado_id, 10);

            // PODs
            if (es_pod) {
                podsTotalesEnProceso += nTotal;
                if(r.transito_lab||(sId===6&&r.etapa_qa==='RECEPCION')){conteoEnTransito+=nTotal;return;}
            if (sId === 7) podsRecuperados += nTotal; // 7 = DISPONIBLE
            }

            // Clasificación por Ubicación/Estado (Workflow oficial por ID)
            if (r.retiro_pendiente) return;
            if(r.transito_lab||(sId===6&&r.etapa_qa==='RECEPCION')){conteoEnTransito+=nTotal;return;}
            if (sId === 7) { // DISPONIBLE
                conteoDisponibles += nTotal;
            } else if (sId === 2 || sId === 11) { // 2=EN_TRANSITO, 11=EN_TRAYECTO_BODEGA
                conteoEnTransito += nTotal;
            } else if (sId === 3) { // 3=RECIBIDO_BODEGA
                conteoEnBodega += nTotal;
            } else if (r.carga_lab && [4, 5, 9, 10].includes(sId)) { // 4=DIAG, 5=REPAR, 9=REPUESTO, 10=FINALIZADO
                conteoEnTaller += nTotal;
                if (tipo === 'CONSOLA') consolasEnTaller += nTotal;
                if (tipo === 'VALIDADOR') validadoresEnTaller += nTotal;
            }
        });

        // Count assets using the same operating list definition, never subtract
        // intervention counts from inventory (one asset may have several OS).
        const operativosFinal = Number((await client.query(`SELECT COUNT(*) FROM (${operatingAssetsSql}) activos`)).rows[0].count);
        const logisticCounts = (await client.query(`SELECT
          COUNT(DISTINCT (o.tipo_equipo,COALESCE(o.validador_serie,o.consola_serie))) FILTER (WHERE ${installationReadySql()}) AS disponibles,
          COUNT(DISTINCT (o.tipo_equipo,COALESCE(o.validador_serie,o.consola_serie))) FILTER (WHERE ${terrainDispatchSql()}) AS en_ruta,
          COUNT(DISTINCT (o.tipo_equipo,COALESCE(o.validador_serie,o.consola_serie))) FILTER (WHERE ${assignedWithoutDispatchSql()}) AS asignados
          FROM pmp.ordenes_servicio o`)).rows[0];
        const nuevosDisponibles=Number((await client.query(`SELECT count(*) FROM (${initialAssetStockSql}) nuevos`)).rows[0].count);
        conteoDisponibles = Number(logisticCounts.disponibles)+nuevosDisponibles;
        conteoEnBodega += nuevosDisponibles;

        // 5. DATOS PARA GRÁFICOS
        const pieData = [
            { name: 'En Taller', value: conteoEnTaller },
            { name: 'QA por verificar', value: osRows.filter(r=>r.etapa_qa==='POR_VERIFICAR').reduce((sum,r)=>sum+Number(r.total),0) },
            { name: 'En QA', value: osRows.filter(r=>r.carga_qa).reduce((sum,r)=>sum+Number(r.total),0) },
            { name: 'En Bodega', value: conteoEnBodega },
            { name: 'En Tránsito', value: conteoEnTransito }
        ].filter(d => d.value > 0);

        const barData = [
            { name: 'En operación', cantidad: operativosFinal },
            { name: 'Disponible para instalación', cantidad: conteoDisponibles },
            { name: 'En Logística', cantidad: conteoEnBodega + conteoEnTransito },
            { name: 'En Taller', cantidad: conteoEnTaller },
            { name: 'Asignado a técnico', cantidad: Number(logisticCounts.asignados) },
            { name: 'En ruta', cantidad: Number(logisticCounts.en_ruta) },
            { name: 'En QA', cantidad: osRows.filter(r=>r.carga_qa).reduce((sum,r)=>sum+Number(r.total),0) }
        ];

        res.json({
            kpis: {
                ordenesActivas,
                totalEnProceso: conteoEnTaller, // Lo que realmente está en Lab
                consolasEnLab: consolasEnTaller,
                validadoresEnLab: validadoresEnTaller,
                totalReparadosLab: osRows.filter(r => parseInt(r.estado_id, 10) === 10).reduce((a, b) => a + parseInt(b.total, 10), 0),
                totalEnQa: osRows.filter(r => r.carga_qa).reduce((a, b) => a + parseInt(b.total, 10), 0),

                totalReparados: conteoDisponibles,
                totalOperativos: operativosFinal,
                totalEnRuta: Number(logisticCounts.en_ruta),
                totalAsignados: Number(logisticCounts.asignados),
                totalEnBodega: conteoEnBodega,   // <--- NUEVO
                totalEnTransito: conteoEnTransito, // <--- NUEVO
                totalPods: podsTotalesEnProceso,
                podsReparados: podsRecuperados,
                tiempoPromedio: null // No existe una medición agregada implementada; no publicar un valor de ejemplo.
            },
            charts: {
                pieData,
                barData
            }
        });

    } finally {
        client.release();
    }
  } catch (err) {
    console.error("Dashboard Error:", err);
    next(err);
  }
});

/**
 * GET /api/dashboard/equipos-operativos
 * Lista detallada de equipos que no tienen una OS activa (operativos en buses)
 */
router.get("/equipos-operativos", authorize('operating-assets.read'), async (req, res, next) => {
    const { q = '', limit = 20, offset = 0 } = req.query;
    try {
        const queryStr = `%${q}%`;
        const sql = `
            SELECT h.*, COUNT(*) OVER() AS total_count
            FROM (${operatingAssetsSql}) h
            WHERE h.serie ILIKE $1 OR h.bus_ppu ILIKE $1 OR h.modelo ILIKE $1 OR h.tipo ILIKE $1
            ORDER BY h.ultima_operacion DESC NULLS LAST,h.tipo,h.serie
            LIMIT $2 OFFSET $3
        `;

        const { rows } = await pool.query(sql, [queryStr, limit, offset]);

        const totalCount = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
        const data = rows.map(r => {
            const { total_count, ...rest } = r;
            return rest;
        });

        res.json({
            data,
            pagination: {
                total: totalCount,
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10)
            }
        });
    } catch (err) {
        console.error("Error Equipos Operativos:", err);
        next(err);
    }
});
/**
 * GET /api/dashboard/global-search
 * Búsqueda global de trazabilidad por código OS, referencia reservada o serie.
 */
router.get("/global-search", requireAnyRole(...Object.values(ROLES)), async (req,res,next) => {
  try { res.json(req.query.q ? await searchAssets(pool,req.query.q) : []); }
  catch (error) { sendFlowError(res,error,next); }
});

export default router;
