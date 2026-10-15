import { logisticsStateSql, pendingTerrainSql } from './logisticsPresentation.js';

// Read-only projection: keep the existing pending-withdrawal predicate and transitions.
export async function listPendingWithdrawals(client, {code=null,technicianId=null}={}) {
  return (await client.query(`SELECT o.codigo_os,o.tipo_equipo,COALESCE(o.validador_serie,o.consola_serie) AS serie,
    CASE WHEN o.tipo_equipo='VALIDADOR' THEN v.modelo ELSE console.modelo END AS modelo,
    CASE WHEN o.tipo_equipo='VALIDADOR' THEN v.marca ELSE console.marca END AS marca,
    c.id AS caso_id,c.codigo_caso,
    COALESCE(NULLIF(btrim(o.bus_ppu),''),NULLIF(btrim(c.bus_ppu),''),installed.bus_ppu) AS bus_ppu,
    o.tecnico_terreno_id,NULLIF(concat_ws(' ',u.nombre,u.apellido),'') AS tecnico,
    COALESCE(NULLIF(btrim(t.nombre),''),NULLIF(btrim(ct.nombre),''),it.nombre) AS terminal,
    COALESCE(NULLIF(btrim(p.nombre),''),NULLIF(btrim(cp.nombre),''),ip.nombre) AS operador,
    COALESCE(NULLIF(btrim(o.falla),''),NULLIF(btrim(c.falla_reportada),''),NULLIF(btrim(origin.falla),'')) AS falla,
    ${logisticsStateSql()} AS estado_actual,
    COALESCE(NULLIF(btrim(c.referencia_externa),''),NULLIF(btrim(o.ticket_aranda),''),
      (SELECT string_agg(DISTINCT r.referencia_externa,', ' ORDER BY r.referencia_externa)
       FROM pmp.v_referencias_activo r WHERE r.codigo_os IN (o.codigo_os,o.os_origen) AND upper(r.sistema_externo)='ARANDA'),
      NULLIF(btrim(req.metadata->>'referencia_externa'),'')) AS referencia_ar
    FROM pmp.ordenes_servicio o JOIN pmp.estados e ON e.id=o.estado_id
    LEFT JOIN pmp.ordenes_servicio origin ON origin.codigo_os=o.os_origen
    LEFT JOIN LATERAL (SELECT f.metadata FROM pmp.flujo_eventos f
      WHERE f.codigo_os IN (o.codigo_os,o.os_origen) AND f.tipo='REQUERIMIENTO_INGRESADO'
      ORDER BY f.fecha DESC,f.id DESC LIMIT 1) req ON true
    LEFT JOIN pmp.casos_operacionales c ON c.id::text=COALESCE(o.caso_id::text,origin.caso_id::text,req.metadata->>'caso_id')
    LEFT JOIN LATERAL (SELECT i.bus_ppu,i.terminal_id,i.pst_codigo FROM pmp.ordenes_servicio i
      WHERE i.tipo_equipo=o.tipo_equipo AND COALESCE(i.validador_serie,i.consola_serie)=COALESCE(o.validador_serie,o.consola_serie)
        AND (i.estado_id=12 OR (i.estado_id=13 AND i.es_instalacion IS TRUE))
        AND (COALESCE(NULLIF(btrim(o.bus_ppu),''),NULLIF(btrim(c.bus_ppu),'')) IS NULL
          OR i.bus_ppu=COALESCE(NULLIF(btrim(o.bus_ppu),''),NULLIF(btrim(c.bus_ppu),'')))
      ORDER BY i.fecha DESC,i.codigo_os DESC LIMIT 1) installed ON true
    LEFT JOIN pmp.terminales t ON t.id=o.terminal_id LEFT JOIN pmp.pst p ON p.codigo=o.pst_codigo
    LEFT JOIN pmp.terminales ct ON ct.id=c.terminal_id LEFT JOIN pmp.pst cp ON cp.codigo=c.pst_codigo
    LEFT JOIN pmp.terminales it ON it.id=installed.terminal_id LEFT JOIN pmp.pst ip ON ip.codigo=installed.pst_codigo
    LEFT JOIN pmp.validadores v ON o.tipo_equipo='VALIDADOR' AND v.serie=o.validador_serie
    LEFT JOIN pmp.consolas console ON o.tipo_equipo='CONSOLA' AND console.serie=o.consola_serie
    LEFT JOIN pmp.usuarios u ON u.id=o.tecnico_terreno_id
    WHERE ${pendingTerrainSql()} AND ($1::text IS NULL OR o.codigo_os=$1)
      AND ($2::uuid IS NULL OR o.tecnico_terreno_id=$2) ORDER BY o.fecha,o.codigo_os`,[code,technicianId])).rows;
}
