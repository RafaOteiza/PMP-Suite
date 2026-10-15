import {requireAssetIdentity} from './assetIdentity.js';
import {validateReceiptScanner} from './warehouseReceipt.js';
import { FlowError, requireEquipmentType, requireText, optionalText, requireIsoDate,
  equipmentColumns, requireEquipment, requirePositiveInteger, withTransaction, addFlowEvent } from './bridgeFlow.js';
import { confirmEquipmentScanWithClient, requireLatestAssetScan, canConfirmAtStation } from './equipmentScan.js';
import { initialAssetStockSql } from './initialAssetStock.js';
import { operatingAssetsSql, logisticsStateSql } from './logisticsPresentation.js';

function requireManualReceptionRole(user) {
  if (!['logistica'].includes(user.rol))
    throw new FlowError(403,'MANUAL_RECEPTION_FORBIDDEN','Solo logística puede autorizar una recepción inicial manual');
}

export function validateManualReceptionInput(body,user,asset) {
  requireManualReceptionRole(user);
  if (body.codigo !== asset.serie || body.tipo_equipo !== asset.tipo_equipo)
    throw new FlowError(422,'SCANNED_ASSET_MISMATCH','Ingresa exactamente la serie del activo seleccionado, respetando mayúsculas y sin espacios adicionales');
  if (body.presencia_fisica_confirmada !== true)
    throw new FlowError(422,'PHYSICAL_PRESENCE_REQUIRED','Confirma que tienes físicamente este equipo en Bodega y verificaste su identidad');
}

export async function searchRegisteredAssets(client, query={}) {
  const offset=Math.max(0,Number.parseInt(query.offset,10)||0),limit=Math.min(100,Math.max(1,Number.parseInt(query.limit,10)||30));
  const type=requireEquipmentType(query.tipo_equipo);
  const q=optionalText(query.q,'q',{max:50}) || '';
  const bus=optionalText(query.bus_ppu,'bus_ppu',{max:10})?.toUpperCase() || '';
  const {table}=equipmentColumns(type,'lookup');
  const pattern=`%${q.replace(/[\\%_]/g,'\\$&')}%`;
  return (await client.query(`WITH operating AS (${operatingAssetsSql})
    SELECT $1::text AS tipo_equipo,m.*,op.bus_ppu,
      CASE WHEN op.serie IS NOT NULL THEN 'EN_OPERACION'
        WHEN initial.stock_origen_evento IS NOT NULL THEN 'DISPONIBLE_INSTALACION'
        WHEN o.codigo_os IS NULL THEN 'REGISTRADO'
        ELSE ${logisticsStateSql()} END AS estado_actual,
      o.codigo_os AS ultima_os,(o.codigo_os IS NULL AND initial.stock_origen_evento IS NULL) AS puede_iniciar_recepcion
    FROM pmp.${table} m
    LEFT JOIN operating op ON op.tipo=$1 AND op.serie=m.serie
    LEFT JOIN (${initialAssetStockSql}) initial ON initial.tipo_equipo=$1 AND initial.serie=m.serie
    LEFT JOIN LATERAL (SELECT * FROM pmp.ordenes_servicio x
      WHERE x.tipo_equipo=$1 AND COALESCE(x.validador_serie,x.consola_serie)=m.serie
      ORDER BY x.fecha DESC,x.codigo_os DESC LIMIT 1) o ON true
    LEFT JOIN pmp.estados e ON e.id=o.estado_id
    WHERE m.serie ILIKE $2 AND ($3='' OR op.bus_ppu=$3)
    ORDER BY m.serie LIMIT $4 OFFSET $5`,[type,pattern,bus,limit,offset])).rows;
}

export async function requireOperationalAsset(client,type,series,bus) {
  const {table}=equipmentColumns(type,series);
  const master=await client.query(`SELECT serie FROM pmp.${table} WHERE serie=$1 FOR UPDATE`,[series]);
  if(!master.rowCount) throw new FlowError(422,'UNKNOWN_EQUIPMENT',
    'Activo no registrado en PMP Suite. El activo debe registrarse previamente en Gestión de activos antes de generar un requerimiento.');
  const current=await client.query(`SELECT * FROM (${operatingAssetsSql}) op WHERE op.tipo=$1 AND op.serie=$2`,[type,series]);
  if(!current.rowCount) throw new FlowError(409,'ASSET_NOT_IN_OPERATION','El activo no tiene una relación vigente de operación con un bus. Revisa Gestión de activos y su historial.');
  if(current.rows[0].bus_ppu!==bus) throw new FlowError(409,'ASSET_BUS_MISMATCH',`El activo está asociado al bus ${current.rows[0].bus_ppu}, no a ${bus}`);
}

export function assetRegistrationInput(body={}) {
  const tipo=requireEquipmentType(body.tipo_equipo),serie=requireText(body.serie,'serie',{max:50}).toUpperCase();
  return {tipo,serie,...requireAssetIdentity(tipo,serie,body),
    origen:requireText(body.origen,'origen',{max:80}),fecha:requireIsoDate(body.fecha_ingreso,'fecha_ingreso'),
    observacion:optionalText(body.observacion,'observacion',{max:4000})};
}
export async function registerAsset(pool,body,user) {
  const input=assetRegistrationInput(body),{table}=equipmentColumns(input.tipo,input.serie);
  return withTransaction(pool,async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${input.tipo}|${input.serie}`]);
    const result=await client.query(`INSERT INTO pmp.${table}
      (serie,modelo,marca,origen_registro,fecha_ingreso,observacion_registro,registrado_por)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(serie) DO NOTHING RETURNING *`,
    [input.serie,input.modelo,input.marca,input.origen,input.fecha,input.observacion,user.id]);
    if(!result.rowCount) throw new FlowError(409,'ASSET_EXISTS','El activo ya está registrado. Busca su tipo y serie; no se modificaron sus datos.');
    await addFlowEvent(client,{asset:{tipo_equipo:input.tipo,serie:input.serie},type:'ALTA_ACTIVO',user,comment:input.observacion,metadata:{origen:input.origen,fecha_ingreso:input.fecha}});
    return {tipo_equipo:input.tipo,...result.rows[0],estado_actual:'REGISTRADO',puede_iniciar_recepcion:true};
  });
}

async function newAssetForReception(client,body) {
  const asset={tipo_equipo:requireEquipmentType(body.tipo_equipo),serie:requireText(body.serie,'serie',{max:50}).toUpperCase()};
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${asset.tipo_equipo}|${asset.serie}`]);
  await requireEquipment(client,asset.tipo_equipo,asset.serie);
  if((await client.query(`SELECT 1 FROM pmp.ordenes_servicio WHERE tipo_equipo=$1 AND COALESCE(validador_serie,consola_serie)=$2
    UNION ALL SELECT 1 FROM pmp.flujo_eventos WHERE tipo_equipo=$1 AND serie=$2 AND tipo='HABILITADO_INSTALACION'`,[asset.tipo_equipo,asset.serie])).rowCount)
    throw new FlowError(409,'INITIAL_RECEPTION_NOT_ALLOWED','El activo ya fue recibido o tiene un circuito operacional. Consulta su historial.');
  return asset;
}
export async function validateAssetReception(pool,body,user) {
  return withTransaction(pool,async client=>{
    const asset=await newAssetForReception(client,body);
    if(body.origen_captura==='MANUAL') return {equipo:asset,escaneo:null,elegible:false};
    if(body.origen_captura==='MANUAL_AUTORIZADO') {
      validateManualReceptionInput(body,user,asset);
      const location=(await client.query("SELECT id FROM pmp.ubicaciones WHERE tipo='BODEGA' ORDER BY id LIMIT 1")).rows[0];
      if(!location) throw new FlowError(409,'SCAN_LOCATION_NOT_CONFIGURED','No existe una ubicación configurada para BODEGA');
      const validation=await addFlowEvent(client,{asset,type:'VALIDACION_BODEGA',user,
        comment:'Ingreso manual autorizado (MANUAL_AUTORIZADO). Confirmo que tengo físicamente este equipo en Bodega y verifiqué su identidad.',
        metadata:{circuito:'ACTIVO_NUEVO',contexto:'RECEPCION_INICIAL',origen_captura:'MANUAL_AUTORIZADO',
          codigo_leido:body.codigo,presencia_fisica_confirmada:true,ubicacion_id:location.id}});
      return {equipo:asset,escaneo:null,validacion:{id:validation.id},origen_captura:'MANUAL_AUTORIZADO',elegible:true};
    }
    if(body.origen_captura!=='SCANNER') throw new FlowError(409,'PHYSICAL_SCAN_REQUIRED','Selecciona la captura con lector y escanea el equipo en Bodega');
    const proof=validateReceiptScanner(body);
    const result=await confirmEquipmentScanWithClient(client,{code:body.codigo,station:'BODEGA',user,assetOnly:true,expectedAsset:asset,
      metadata:{contexto:'RECEPCION_INICIAL',origen_captura:'SCANNER',lectura_scanner:proof}});
    return {...result,elegible:true};
  });
}
export async function startAssetReception(pool,body,user) {
  return withTransaction(pool,async client=>{
    const manual=body.validacion_id!=null;
    if(manual) requireManualReceptionRole(user);
    else if(!canConfirmAtStation(user.rol,'BODEGA')) throw new FlowError(403,'SCAN_STATION_FORBIDDEN','Tu rol no confirma recepciones físicas en Bodega');
    const identity={tipo_equipo:requireEquipmentType(body.tipo_equipo),serie:requireText(body.serie,'serie',{max:50}).toUpperCase()};
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${identity.tipo_equipo}|${identity.serie}`]);
    const prior=(await client.query("SELECT * FROM pmp.flujo_eventos WHERE tipo_equipo=$1 AND serie=$2 AND tipo='HABILITADO_INSTALACION' ORDER BY id DESC LIMIT 1",[identity.tipo_equipo,identity.serie])).rows[0];
    const request={validacion_id:body.validacion_id?String(body.validacion_id):null,escaneo_id:body.escaneo_id?String(body.escaneo_id):null,conforme:body.validacion_inicial_conforme===true,observacion:optionalText(body.observacion,'observacion',{max:4000})};
    if(prior){
     if(String(prior.usuario_id)!==String(user.id)||!prior.metadata.solicitud||Object.keys(request).some(k=>request[k]!==prior.metadata.solicitud[k]))throw new FlowError(409,'INITIAL_RECEPTION_RETRY_CONFLICT','La recepción ya se confirmó con otro contexto');
     return {equipo:identity,stock_origen_evento:prior.id,estado_actual:'DISPONIBLE_INSTALACION',duplicado:true};
    }
    const asset=await newAssetForReception(client,body);
    let metadata;
    if(manual) {
      if(body.escaneo_id) throw new FlowError(422,'AMBIGUOUS_RECEPTION_EVIDENCE','Selecciona una única forma de captura');
      const validationId=requirePositiveInteger(body.validacion_id,'validacion_id');
      const validation=(await client.query(`SELECT f.* FROM pmp.flujo_eventos f
        JOIN pmp.ubicaciones u ON u.id::text=f.metadata->>'ubicacion_id' AND u.tipo='BODEGA'
        WHERE f.tipo_equipo=$1 AND f.serie=$2 AND f.tipo='VALIDACION_BODEGA' AND f.codigo_os IS NULL
        ORDER BY f.fecha DESC,f.id DESC LIMIT 1`,[asset.tipo_equipo,asset.serie])).rows[0];
      if(!validation || String(validation.id)!==String(validationId) || String(validation.usuario_id)!==String(user.id)
        || !['admin','logistica'].includes(validation.rol) || validation.metadata.origen_captura!=='MANUAL_AUTORIZADO'
        || validation.metadata.contexto!=='RECEPCION_INICIAL' || validation.metadata.circuito!=='ACTIVO_NUEVO'
        || validation.metadata.codigo_leido!==asset.serie || validation.metadata.presencia_fisica_confirmada!==true)
        throw new FlowError(409,'MANUAL_RECEPTION_REQUIRED','Valida nuevamente la serie mediante ingreso manual autorizado');
      if((await client.query(`SELECT 1 FROM pmp.escaneos_equipos WHERE tipo_equipo=$1 AND serie=$2
        AND resultado='VALIDADO' AND fecha>$3`,[asset.tipo_equipo,asset.serie,validation.fecha])).rowCount)
        throw new FlowError(409,'MANUAL_RECEPTION_REQUIRED','Existe una lectura posterior. Valida nuevamente la presencia física del activo');
      metadata={validacion_id:validation.id,ubicacion_id:validation.metadata.ubicacion_id,origen_captura:'MANUAL_AUTORIZADO'};
    } else {
      if(!body.escaneo_id) throw new FlowError(409,'PHYSICAL_SCAN_REQUIRED','Escanea el activo o realiza un ingreso manual autorizado en Bodega antes de recibirlo');
      const scanId=requirePositiveInteger(body.escaneo_id,'escaneo_id');
      const scan=await requireLatestAssetScan(client,{asset,scanId,user,context:'RECEPCION_INICIAL'});
      validateReceiptScanner({codigo:scan.codigo_leido,lectura_scanner:scan.metadata.lectura_scanner});
      metadata={escaneo_id:scan.id,ubicacion_id:scan.ubicacion_id,origen_captura:'SCANNER'};
    }
    if(body.validacion_inicial_conforme!==true)
      throw new FlowError(422,'INITIAL_VALIDATION_REQUIRED','Confirma la identidad, integridad y conformidad inicial del equipo antes de habilitarlo');
    const note=optionalText(body.observacion,'observacion',{max:4000});
    const comment=`Origen de captura: ${metadata.origen_captura}.${note?' '+note:''}`;
    metadata.validacion_inicial_conforme=true;metadata.solicitud=request;
    const receipt=await addFlowEvent(client,{asset,type:'RECEPCION_INICIAL',user,comment,metadata});
    const enabled=await addFlowEvent(client,{asset,type:'HABILITADO_INSTALACION',user,comment,metadata:{...metadata,recepcion_id:receipt.id}});
    return {equipo:asset,recepcion:receipt,stock_origen_evento:enabled.id,estado_actual:'DISPONIBLE_INSTALACION'};
  });
}

