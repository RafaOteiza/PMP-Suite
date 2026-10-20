import { FlowError, requireEquipmentType, requireText } from './bridgeFlow.js';
import { operatingAssetsSql, logisticsStateSql } from './logisticsPresentation.js';

const activeOrders = `SELECT o.codigo_os,o.caso_id,o.bus_ppu,o.falla,${logisticsStateSql()} AS estado_actual,
  NULLIF(concat_ws(' ',u.nombre,u.apellido),'') AS tecnico,
  COALESCE(c.referencia_externa,(SELECT string_agg(DISTINCT r.referencia_externa,', ')
    FROM pmp.v_referencias_activo r WHERE r.codigo_os=o.codigo_os AND upper(r.sistema_externo)='ARANDA')) AS referencia_ar
  FROM pmp.ordenes_servicio o JOIN pmp.estados e ON e.id=o.estado_id
  LEFT JOIN pmp.casos_operacionales c ON c.id=o.caso_id
  LEFT JOIN pmp.usuarios u ON u.id=COALESCE(o.tecnico_terreno_id,o.tecnico_laboratorio_id,o.qa_usuario_id)
  WHERE o.tipo_equipo=$1 AND COALESCE(o.validador_serie,o.consola_serie)=$2 AND o.estado_id NOT IN (8,12,13)`;

export async function activeRequirementOrders(client,query) {
  const type=requireEquipmentType(query.tipo_equipo),series=requireText(query.serie,'serie',{max:50});
  return (await client.query(`${activeOrders} ORDER BY o.fecha DESC,o.codigo_os`,[type,series])).rows;
}

export function operationalSearchInput(query) {
  const type=requireEquipmentType(query.tipo_equipo);
  const term=(value,max)=>{if(value===undefined)return '';if(typeof value!=='string'||value.length>max)throw new FlowError(422,'INVALID_QUERY','Filtro de búsqueda inválido');return value.trim();};
  const q=term(query.q,50),bus=term(query.bus_ppu,10).toUpperCase();
  const integer=(value,fallback,max)=>{if(value===undefined)return fallback;if(!/^\d+$/.test(String(value))||Number(value)>max)throw new FlowError(422,'INVALID_QUERY','Paginación inválida');return Number(value);};
  const limit=integer(query.limit,20,50),offset=integer(query.offset,0,100000);
  if(!limit)throw new FlowError(422,'INVALID_QUERY','El límite debe ser mayor que cero');
  if(query.bus_exacto!==undefined&&!['true','false',true,false].includes(query.bus_exacto))throw new FlowError(422,'INVALID_QUERY','Filtro de bus inválido');
  return {type,q,bus,limit,offset,exact:query.bus_exacto===true||query.bus_exacto==='true'};
}
const pattern=text=>`%${text.replace(/[\\%_]/g,'\\$&')}%`;

// Local to requirement entry: the asset master and the logistics definitions stay unchanged.
export async function searchRequirementAssets(client,query) {
  const {type,q,bus,limit,offset,exact}=operationalSearchInput(query);
  const rows=(await client.query(`WITH operating AS (${operatingAssetsSql})
    SELECT op.tipo AS tipo_equipo,op.serie,op.modelo,op.marca,op.bus_ppu,'EN_OPERACION' AS estado_actual,
      installed.terminal_id,t.nombre AS terminal,installed.pst_codigo,p.nombre AS operador
    FROM operating op
    JOIN LATERAL (
      SELECT o.terminal_id,o.pst_codigo FROM pmp.ordenes_servicio o
      WHERE o.tipo_equipo=op.tipo AND COALESCE(o.validador_serie,o.consola_serie)=op.serie AND o.bus_ppu=op.bus_ppu
      ORDER BY CASE WHEN o.estado_id=12 OR (o.estado_id=13 AND o.es_instalacion IS TRUE) THEN 0 ELSE 1 END,
        o.fecha DESC,o.codigo_os DESC LIMIT 1
    ) installed ON true
    LEFT JOIN pmp.terminales t ON t.id=installed.terminal_id LEFT JOIN pmp.pst p ON p.codigo=installed.pst_codigo
    WHERE op.tipo=$1 AND op.serie ILIKE $2 AND ($3='' OR CASE WHEN $4 THEN op.bus_ppu=$3 ELSE op.bus_ppu ILIKE $5 END)
      AND ($8::text IS NULL OR op.serie=$8)
    ORDER BY op.serie,op.bus_ppu LIMIT $6 OFFSET $7`,[type,pattern(q),bus,exact,pattern(bus),limit+1,offset,
      query.serie_exacta===undefined?null:requireText(query.serie_exacta,'serie_exacta',{max:50})])).rows;
  return {items:rows.slice(0,limit),has_more:rows.length>limit,limit,offset};
}

export async function searchRequirementBuses(client,query) {
  const {type,bus,limit,offset}=operationalSearchInput(query);
  const rows=(await client.query(`SELECT DISTINCT op.bus_ppu FROM (${operatingAssetsSql}) op
    WHERE op.tipo=$1 AND op.bus_ppu ILIKE $2 ORDER BY op.bus_ppu LIMIT $3 OFFSET $4`,[type,pattern(bus),limit+1,offset])).rows;
  return {items:rows.slice(0,limit),has_more:rows.length>limit,limit,offset};
}
