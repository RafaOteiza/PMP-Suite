import {runQaCustodyScenarios} from './qa_custody_scenarios.mjs';
import {runLabWorkScenarios} from './lab_work_scenarios.mjs';
import { labArrivalJoin } from '../src/services/labArrival.js';
import { runWithdrawalCameraScenarios } from './withdrawal_camera_scenarios.mjs';
import { runTerrainWarehouseScenarios } from './terrain_warehouse_scenarios.mjs';
import { runRequirementSearchScenarios } from './requirement_search_scenarios.mjs';
import { runMasterScenarios } from './asset_management_scenarios.mjs';
import assert from 'node:assert/strict';

export async function runRequirementsScenarios({pool,baseUrl,fixture,users,request,expect,scan,report,pst,bus}) {
  // Existing scanner scenarios simulate the keyboard-wedge proof explicitly in this isolated harness.
  const call=(actor,method,path,body)=>request(baseUrl,actor,method,path,
    path==='/api/bodega/despacho/validar'&&body?.origen_captura==='SCANNER'
      ?{...body,lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(body.codigo.length).fill(10)}}:body);
  const stock=async()=>expect(await call('logistica','GET','/api/bodega/stock'),200,'stock');
  const count=async(table)=>Number((await pool.query(`SELECT count(*) n FROM pmp.${table}`)).rows[0].n);
  const create=async(reference,type,series,pod=false)=>expect(await call('logistica','POST','/api/requerimientos',{
    origen:reference?'ARANDA':'INTERNO',referencia_externa:reference||undefined,tipo_equipo:type,serie:series,
    bus_ppu:bus,terminal_id:fixture.terminalId,pst_codigo:pst,falla:'QR',observacion:'Ingreso asistido E2E',
    clasificacion:pod?'POD':'MANTENCION',fecha_requerimiento:new Date().toISOString()
  }),201,`ingreso ${reference||'INTERNO'}`);
  await pool.query(`INSERT INTO pmp.validadores(serie,modelo) VALUES
    ('7404593','CVB45'),('7400010','CVB45'),('7400011','CVB45'),('7400012','CVB45'),
    ('7400013','CVB45'),('7400014','CVB45'),('7400015','CVB45'),('7400016','CVB45'),
    ('7400100','CVB45'),('7400101','CVB45'),('7400102','CVB45'),('7400103','CVB45'),
    ('7400104','CVB45'),('7400105','CVB45'),('7400106','CVB45')`);
  await pool.query("INSERT INTO pmp.consolas(serie,modelo) VALUES ('9715A0024','C'),('9715A0025','C'),('9715A0026','C')");
  const initialOrders=[];
  for(const [type,series] of [['VALIDADOR','7404593'],['VALIDADOR','7400012'],['VALIDADOR','7400013'],['VALIDADOR','7400014'],['VALIDADOR','7400015'],['CONSOLA','9715A0024'],['CONSOLA','9715A0025']]) {
    const os=(await pool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,consola_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo)
      VALUES($1,$2,$3,'Parque inicial E2E',12,$4,$5,$6) RETURNING *`,[type,type==='VALIDADOR'?series:null,type==='CONSOLA'?series:null,bus,fixture.terminalId,pst])).rows[0];
    initialOrders.push(os);
  }
  for(const type of ['VALIDADOR','CONSOLA']) {
    const suggestions=expect(await call('logistica','GET',`/api/activos?tipo_equipo=${type}&bus_ppu=${bus}`),200,'bus sugiere maestro instalado');
    assert.ok(suggestions.length);assert.ok(suggestions.every(a=>a.tipo_equipo===type&&a.bus_ppu===bus&&a.estado_actual==='EN_OPERACION'));
  }
  const original=await create('12345678','VALIDADOR','7404593');
  assert.equal(original.os.codigo_os,'MV-12345678');
  assert.equal(original.caso.codigo_caso,'AR-12345678');
  assert.equal(original.os.tecnico_terreno_id,null);
  const listed=expect(await call('logistica','GET','/api/requerimientos?q=AR-12345678'),200,'listado casos para despacho');
  assert.equal(listed[0].codigo_caso,'AR-12345678');assert.equal(listed[0].ordenes[0].codigo_os,'MV-12345678');
  assert.equal((await stock()).listos.length,0);
  assert.equal(await count('flujo_eventos'),1,'solo ingreso; sin despacho');
  const zero=await create('AR-00123456','VALIDADOR','7400012');
  assert.equal(zero.os.codigo_os,'MV-00123456');
  assert.equal(typeof zero.caso.componente,'string');
  assert.equal((await create('AR-22334455','CONSOLA','9715A0024')).os.codigo_os,'MC-22334455');
  assert.equal((await create('AR-33445566','VALIDADOR','7400013',true)).os.codigo_os,'PDV-33445566');
  assert.equal((await create('AR-44556677','CONSOLA','9715A0025',true)).os.codigo_os,'PDC-44556677');
  const pendingWithdrawals=expect(await call('logistica','GET','/api/os/pendientes-retiro'),200,'MV/MC/PDV/PDC disponibles para coordinar retiro');
  for(const code of ['MV-12345678','MC-22334455','PDV-33445566','PDC-44556677']){
    const pending=pendingWithdrawals.find(o=>o.codigo_os===code);
    assert.ok(pending,code);assert.equal(pending.estado_actual,'PENDIENTE_RETIRO');assert.equal(pending.tecnico_terreno_id,null);
  }
  const internal=await create(null,'VALIDADOR','7400014');
  assert.match(internal.os.codigo_os,/^MV-\d{6,}$/);
  assert.equal(internal.caso.origen,'INTERNO');
  assert.equal(internal.caso.referencia_externa,null);
  const duplicate=await call('logistica','POST','/api/requerimientos',{
    origen:'ARANDA',referencia_externa:'AR-12345678',tipo_equipo:'VALIDADOR',serie:'7404593',bus_ppu:bus,
    terminal_id:fixture.terminalId,pst_codigo:pst,falla:'QR',fecha_requerimiento:new Date().toISOString()
  });
  expect(duplicate,409,'duplicado controlado');
  for(const actor of ['terreno','lab','qa']) expect(await call(actor,'POST','/api/requerimientos',{}),403,'permiso ingreso');
  await assert.rejects(pool.query("UPDATE pmp.ordenes_servicio SET validador_serie='7400010' WHERE codigo_os=$1",[original.os.codigo_os]),e=>e.code==='23514');
  const podSource=await create('AR-55667788','VALIDADOR','7400015');
  const pod=expect(await call('logistica','POST',`/api/requerimientos/${podSource.caso.id}/pod`,{codigo_os:podSource.os.codigo_os}),201,'derivar POD');
  assert.equal(pod.os.codigo_os,'PDV-55667788');assert.equal(pod.os.os_origen,'MV-55667788');
  assert.equal((await pool.query('SELECT estado_id FROM pmp.ordenes_servicio WHERE codigo_os=$1',[podSource.os.codigo_os])).rows[0].estado_id,13);
  expect(await call('logistica','POST',`/api/requerimientos/${podSource.caso.id}/pod`,{codigo_os:podSource.os.codigo_os}),409,'no derivación duplicada');
  report.steps.push({action:'Ingreso MV/MC/PDV/PDC e interno, ceros iniciales, duplicados, identidad y derivación PoD',ok:true});

  // Complete the ORIGINAL repair through the existing physical station workflow.
  const repair=original.os.codigo_os;
  expect(await call('logistica','POST','/api/os/asignar-retiro',{codigo_os:repair,tecnico_terreno_id:users.terreno.id}),200,'asignar retiro');
  const identity=expect(await call('terreno','POST','/api/os/validar-identidad-retiro',{codigo_os:repair,metodo_validacion:'SCAN',codigo_leido:'7404593'}),200,'identificar equipo');
  expect(await call('terreno','POST','/api/os/confirmar-retiro',{validacion_id:identity.validacion_id,pod:false,codigo_os:repair,tipo_equipo:'VALIDADOR',serie:'7404593',bus_ppu:bus,retiro_confirmado:true,evidencia:'Retiro f?sico verificado E2E'}),200,'confirmar retiro');
  expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',{codigo_os:repair,tipo_equipo:'VALIDADOR',codigo:'7404593',origen_captura:'SCANNER',lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(7).fill(10)}}),200,'validar recepci?n mediante esc?ner');
  expect(await call('logistica','PUT','/api/bodega/receive',{codigo_os:repair}),200,'recepción original');
  expect(await call('admin','PUT','/api/lab/assign',{codigo_os:repair,tecnico_id:users.lab.id}),409,'asignación bloqueada antes de recepción');
  // New exit evidence cannot reuse the already confirmed receipt.
  const beforeLab=(await pool.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1',[repair])).rows[0];
  const beforeLabCount=await count('ordenes_servicio');
  const labBody={codigo_os:repair,tipo_equipo:'VALIDADOR',codigo:'7404593',origen_captura:'SCANNER',lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(7).fill(10)}};
  const labValidate=body=>call('logistica','POST','/api/bodega/dispatch-lab/validar',body);
  const labConfirm=validacion_id=>call('logistica','PUT','/api/bodega/dispatch-lab',{codigo_os:repair,validacion_id});
  expect(await labConfirm(),409,'sin evidencia específica no mueve');
  expect(await labValidate({...labBody,lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(7).fill(200)}}),422,'digitación ordinaria bloqueada');
  let labEvidence=expect(await labValidate(labBody),200,'scanner salida valida sin mover');
  assert.equal(labEvidence.elegible,true);
  assert.equal((await pool.query('SELECT estado_id FROM pmp.ordenes_servicio WHERE codigo_os=$1',[repair])).rows[0].estado_id,3);
  const mismatch=expect(await labValidate({...labBody,codigo:'9999999'}),200,'discrepancia salida');
  assert.equal(mismatch.coincide,false);
  expect(await labConfirm(labEvidence.validacion.id),409,'discrepancia invalida lectura previa');
  assert.ok((await pool.query("SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='DISCREPANCIA_SALIDA_LAB'",[repair])).rowCount);
  const manualLab={...labBody,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true,motivo:'Pistola no disponible'};
  for(const patch of [{codigo:'wrong'},{presencia_fisica_confirmada:false},{motivo:''}])expect(await labValidate({...manualLab,...patch}),422,'manual incompleto bloqueado');
  expect(await call('lab','POST','/api/bodega/dispatch-lab/validar',manualLab),403,'manual rol no autorizado');
  labEvidence=expect(await labValidate(manualLab),200,'manual salida');
  assert.deepEqual((await pool.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1',[repair])).rows[0],beforeLab,'validar/cancelar no cambia OS');
  expect(await call('admin','PUT','/api/bodega/dispatch-lab',{codigo_os:repair,validacion_id:labEvidence.validacion.id}),409,'evidencia vinculada al usuario');
  expect(await labConfirm(labEvidence.validacion.id),200,'salida lab');
  expect(await labConfirm(labEvidence.validacion.id),409,'no reutilizar salida');
  const afterLab=(await pool.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1',[repair])).rows[0];
  assert.equal(afterLab.estado_id,2);assert.equal(afterLab.ubicacion_id,null);
  for(const key of ['codigo_os','validador_serie','caso_id','falla'])assert.equal(afterLab[key],beforeLab[key]);
  assert.equal(await count('ordenes_servicio'),beforeLabCount);
  assert.ok(!expect(await call('logistica','GET','/api/bodega/queue'),200,'cola tras envío').some(o=>o.codigo_os===repair));
  const labEvent=(await pool.query("SELECT * FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='SALIDA_BODEGA_LABORATORIO'",[repair])).rows;
  assert.equal(labEvent.length,1);assert.equal(labEvent[0].metadata.metodo_validacion,'MANUAL_AUTORIZADO');
  report.steps.push({action:'Salida Bodega-Laboratorio: evidencia nueva, scanner/manual, discrepancia, cancelación sin movimiento, confirmación y auditoría sin nueva OS',ok:true});
  expect(await call('admin','PUT','/api/lab/assign',{codigo_os:repair,tecnico_id:users.lab.id}),409,'en tránsito no se asigna');
  const beforeReceiptQueue=expect(await call('admin','GET','/api/lab/queue/VALIDADOR'),200,'cola excluye tránsito');
  assert.ok(!beforeReceiptQueue.some(o=>o.codigo_os===repair));
  const transitDate=(await pool.query(`SELECT ingreso.* FROM pmp.ordenes_servicio o ${labArrivalJoin} WHERE o.codigo_os=$1`,[repair])).rows[0];
  assert.equal(transitDate.fecha,null);assert.equal(transitDate.en_transito,true);assert.equal(transitDate.legacy,false);
  expect(await call('logistica','PUT','/api/bodega/receive',{codigo_os:repair}),409,'no devolver tránsito laboratorio a recepción bodega');
  const badgesBefore=expect(await call('admin','GET','/api/dashboard/badges'),200,'badge antes de recibir');
  await scan(baseUrl,'admin','7404593','LABORATORIO');
  const afterReceiptQueue=expect(await call('admin','GET','/api/lab/queue/VALIDADOR'),200,'cola recibida');
  const receivedItem=afterReceiptQueue.find(o=>o.codigo_os===repair);
  assert.ok(receivedItem);assert.equal(receivedItem.estado_id,4);assert.equal(receivedItem.recepcion_laboratorio_confirmada,true);
  assert.equal(receivedItem.tecnico_laboratorio_id,null);assert.ok(receivedItem.fecha_ingreso_laboratorio);
  const badgesAfter=expect(await call('admin','GET','/api/dashboard/badges'),200,'badge recibido');
  assert.equal(badgesAfter.lab,badgesBefore.lab+1);
  expect(await call('admin','PUT','/api/lab/assign',{codigo_os:repair,tecnico_id:users.lab.id}),200,'asignación después de recepción');

  expect(await call('lab','PUT','/api/lab/move',{codigo_os:repair,nuevo_estado_id:5}),200,'diagnóstico');
  expect(await call('lab','POST','/api/lab/finish',{codigo_os:repair,trabajo:{diagnostico:{resultado:'CONFIRMADA',falla_real:'No lee QR'},acciones:['Limpieza Interna'],pruebas:[{nombre:'Manual',resultado:'APROBADA'}],resultado:'REPARADO'}}),200,'reparación');
  expect(await call('admin','POST','/api/lab/dispatch-qa',{codigos:[repair]}),200,'retorno lab');
  await runQaCustodyScenarios({pool,call,expect,scan,baseUrl,users,report,repair,series:'7404593'});
  const beforeReceipt=await count('ordenes_servicio');
  expect(await call('logistica','PUT','/api/bodega/receive',{codigo_os:repair}),200,'retorno QA');
  assert.equal(await count('ordenes_servicio'),beforeReceipt,'recepción QA no crea IN');
  const closed=(await pool.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1',[repair])).rows[0];
  assert.equal(closed.estado_id,13);assert.equal(closed.es_aprobado_qa,true);
  assert.equal((await stock()).listos.some(o=>o.serie==='7404593'),true);
  const summary=()=>call('admin','GET','/api/dashboard/summary');
  assert.equal(expect(await summary(),200,'dashboard').kpis.totalOperativos,6,'reparado en Bodega no es instalado');
  report.steps.push({action:'Reparación completa hasta QA/Bodega sin IN anticipada',ok:true});

  // Historical approved stock remains eligible; its code is never renamed.
  const seedStock=async(serie,type='VALIDADOR',state=7,qa=true,location=1,assigned=null)=>{
    const os=(await pool.query(`INSERT INTO pmp.ordenes_servicio
      (tipo_equipo,validador_serie,consola_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo,es_instalacion,es_aprobado_qa,ubicacion_id,tecnico_terreno_id)
      VALUES($1,$2,$3,'STOCK E2E',$4,'STOCK',$5,$6,TRUE,$7,$8,$9) RETURNING *`,
    [type,type==='VALIDADOR'?serie:null,type==='CONSOLA'?serie:null,state,fixture.terminalId,pst,qa,location,assigned])).rows[0];
    return os;
  };
  await seedStock('7400010');await seedStock('7400011');await seedStock('9715A0026','CONSOLA');
  await seedStock('7400100','VALIDADOR',6,null,3);
  await seedStock('7400101','VALIDADOR',7,false);
  await seedStock('7400102','VALIDADOR',7,true,2);
  await seedStock('7400103','VALIDADOR',13,null,null);
  await seedStock('7400104','VALIDADOR',7,true,1,users.terreno.id);
  await seedStock('7400105','VALIDADOR',1,true,null,users.terreno.id);
  const ctx={caso_id:original.caso.id,os_origen:repair,tipo_equipo:'VALIDADOR'};
  const validate=code=>call('logistica','POST','/api/bodega/despacho/validar',{...ctx,codigo:code,origen_captura:'SCANNER'});
  for(const series of ['9715A0026','7400100','7400101','7400102','7400103','7400104','7400105','7400014','DESCONOCIDO']) {
    const rejected=await validate(series);assert.ok([404,409,422].includes(rejected.status),JSON.stringify(rejected));
    report.expectedBlocks.push({serie:series,status:rejected.status,error:rejected.data.error});
  }
  const beforeScan=await count('ordenes_servicio');
  const manual=expect(await call('logistica','POST','/api/bodega/despacho/validar',{...ctx,codigo:'7400010',origen_captura:'MANUAL'}),200,'manual consulta');
  assert.ok(!manual.escaneo?.id,'manual no simula evidencia');
  const validation=expect(await validate('7400010'),200,'scanner valida');
  assert.equal(validation.equipo.serie,'7400010');
  assert.equal(await count('ordenes_servicio'),beforeScan,'escaneo no crea IN');
  assert.equal(expect(await summary(),200,'KPI antes').kpis.totalEnRuta,0,'escaneo y asignación no son despacho');
  const payload={...ctx,escaneo_id:validation.escaneo.id,tecnico_terreno_id:users.terreno.id,bus_ppu:bus,terminal_id:fixture.terminalId,pst_codigo:pst};
  const preFailure=await count('ordenes_servicio');
  expect(await call('logistica','POST','/api/bodega/despacho/confirmar',{...payload,pst_codigo:'NO-AUTORIZADO'}),422,'rollback contexto inválido');
  assert.equal(await count('ordenes_servicio'),preFailure,'no huérfanas');
  // Force a failure AFTER the IN and dispatch event were inserted; all must roll back.
  await pool.query(`CREATE FUNCTION pmp.e2e_fail_correlation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.codigo_os LIKE 'IN-%' THEN RAISE EXCEPTION 'E2E forced final correlation failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER e2e_fail_correlation BEFORE INSERT ON pmp.bridge_referencias FOR EACH ROW EXECUTE FUNCTION pmp.e2e_fail_correlation()`);
  const sequenceBeforeFailure=BigInt((await pool.query('SELECT last_value FROM pmp.seq_in')).rows[0].last_value);
  const beforeAtomic={orders:await count('ordenes_servicio'),events:await count('flujo_eventos'),references:await count('bridge_referencias')};
  expect(await call('logistica','POST','/api/bodega/despacho/confirmar',payload),500,'rollback final correlación');
  assert.deepEqual({orders:await count('ordenes_servicio'),events:await count('flujo_eventos'),references:await count('bridge_referencias')},beforeAtomic);
  assert.equal((await pool.query('SELECT siguiente_instalacion FROM pmp.casos_operacionales WHERE id=$1',[ctx.caso_id])).rows[0].siguiente_instalacion,1);
  await pool.query('DROP TRIGGER e2e_fail_correlation ON pmp.bridge_referencias; DROP FUNCTION pmp.e2e_fail_correlation()');
  const sent=expect(await call('logistica','POST','/api/bodega/despacho/confirmar',payload),201,'despacho 01');
  assert.match(sent.os.codigo_os,/^IN-\d{6,}$/);assert.equal(sent.os.instalacion_numero,null);assert.equal(sent.os.validador_serie,'7400010');
  assert.ok(BigInt(sent.os.codigo_os.slice(3))>sequenceBeforeFailure+1n,'rolled-back IN number is never reused');
  assert.equal(sent.os.os_origen,repair);assert.equal(sent.os.estado_id,1);
  expect(await call('logistica','POST','/api/bodega/despacho/confirmar',payload),201,'reintento equivalente devuelve el despacho');
  assert.equal(expect(await summary(),200,'KPI salida').kpis.totalEnRuta,1);
  const mobile=expect(await call('terreno','GET','/api/os/mis-ordenes'),200,'mis órdenes');
  const own=mobile.find(o=>o.codigo_os===sent.os.codigo_os);
  assert.equal(own.estado_nombre,'EN_RUTA');assert.equal(own.codigo_caso,'AR-12345678');assert.equal(own.serie,'7400010');assert.equal(own.es_instalacion,true);
  const secondScan=expect(await validate('7400011'),200,'segunda lectura');
  const concurrent=await Promise.all([0,1].map(()=>call('logistica','POST','/api/bodega/despacho/confirmar',{...payload,escaneo_id:secondScan.escaneo.id})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,201],'ambas respuestas devuelven el mismo despacho bajo concurrencia');
  const second=concurrent.find(r=>r.status===201).data;
  assert.equal(concurrent[0].data.os.codigo_os,concurrent[1].data.os.codigo_os,'reintentos devuelven la misma IN');
  assert.match(second.os.codigo_os,/^IN-\d{6,}$/);assert.ok(BigInt(second.os.codigo_os.slice(3))>BigInt(sent.os.codigo_os.slice(3)));
  expect(await call('terreno','POST','/api/os/completar-instalacion',{codigo_os:repair,operativo:true,bus_ppu:bus}),409,'no instalar reparación');
  expect(await call('terreno','POST','/api/os/completar-instalacion',{codigo_os:sent.os.codigo_os,operativo:true,bus_ppu:bus}),200,'instalar IN');
  assert.equal(expect(await summary(),200,'KPI instalado').kpis.totalEnRuta,1);
  assert.equal(expect(await summary(),200,'KPI operativo').kpis.totalOperativos,7);
  assert.equal((await stock()).listos.some(o=>o.serie==='7400010'),false,'source cerrado no vuelve a stock');
  const originalAfter=(await pool.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1',[repair])).rows[0];
  assert.deepEqual(originalAfter,closed,'despacho e instalación no alteran reparación origen');
  const history=async(series)=>expect(await call('logistica','GET',`/api/bridge/activos/VALIDADOR/${series}/historial`),200,'historial');
  assert.deepEqual((await history('7404593')).ordenes.map(o=>o.codigo_os).sort(),[repair,initialOrders[0].codigo_os].sort());
  assert.equal((await history('7400010')).ordenes.some(o=>o.codigo_os===repair),false);
  const whole=expect(await call('logistica','GET',`/api/requerimientos/${ctx.caso_id}`),200,'caso completo');
  assert.deepEqual(whole.ordenes.map(o=>o.codigo_os).sort(),[sent.os.codigo_os,second.os.codigo_os,repair].sort());
  assert.equal(whole.referencias.length,3);assert.ok(whole.eventos.some(e=>e.tipo==='INSTALACION_COMPLETADA'));
  for(const term of ['7404593',repair,sent.os.codigo_os,'AR-12345678']) assert.ok(expect(await call('logistica','GET',`/api/dashboard/global-search?q=${term}`),200,'búsqueda').length);
  const beforeBridge={orders:await count('ordenes_servicio'),events:await count('flujo_eventos')};
  expect(await call('logistica','POST','/api/bridge',{tipo_equipo:'VALIDADOR',serie:'7400010',codigo_os:sent.os.codigo_os,sistema_externo:'OTRO',referencia_externa:'EXT-2'}),201,'referencia adicional');
  assert.deepEqual({orders:await count('ordenes_servicio'),events:await count('flujo_eventos')},beforeBridge,'Bridge solo correlación');
  const byExtraReference=expect(await call('logistica','GET','/api/requerimientos?q=EXT-2'),200,'caso por referencia adicional');
  assert.equal(byExtraReference.length,1);assert.equal(byExtraReference[0].id,original.caso.id);
  expect(await call('logistica','POST','/api/bridge',{tipo_equipo:'VALIDADOR',serie:'7400010',codigo_os:sent.os.codigo_os,sistema_externo:'ARANDA',referencia_externa:'AR-12345678'}),409,'vínculo exacto duplicado');
  expect(await call('logistica','POST','/api/bridge/asignar',{}),410,'Bridge retirado');
  await seedStock('7400016');
  const internalContext={caso_id:internal.caso.id,os_origen:internal.os.codigo_os,tipo_equipo:'VALIDADOR'};
  const internalScan=expect(await call('logistica','POST','/api/bodega/despacho/validar',{...internalContext,codigo:'7400016',origen_captura:'SCANNER'}),200,'escaneo interno');
  const beforeInternalRefs=await count('bridge_referencias');
  const internalIN=expect(await call('logistica','POST','/api/bodega/despacho/confirmar',{...payload,...internalContext,escaneo_id:internalScan.escaneo.id}),201,'IN autónoma');
  assert.match(internalIN.os.codigo_os,/^IN-\d{6,}$/);
  assert.equal(await count('bridge_referencias'),beforeInternalRefs,'interno no necesita Aranda');
  const legacy=await seedStock('7400106');
  await scan(baseUrl,'logistica','7400106','BODEGA');
  const beforeLegacy=await count('ordenes_servicio');
  expect(await call('logistica','PUT','/api/bodega/asignar',{codigo_os:legacy.codigo_os,tecnico_terreno_id:users.terreno.id,bus_ppu:bus}),200,'compatibilidad IN histórica');
  assert.equal(await count('ordenes_servicio'),beforeLegacy,'IN histórica existente conserva su código');
  expect(await call('terreno','POST','/api/os/completar-instalacion',{codigo_os:legacy.codigo_os,operativo:true,bus_ppu:bus}),200,'completar IN histórica');
  report.steps.push({action:'Physical-first, dos IN, instalación, mobile, KPI, historiales separados y caso completo',ok:true});
  report.steps.push({action:'Rollback tras creación IN/evento, concurrencia y despacho interno sin Aranda',ok:true});

  await runMasterScenarios({pool,call,stock,count,expect,scan,baseUrl,fixture,users,bus,pst,history,create,sent,ctx,report});
  await runWithdrawalCameraScenarios({pool,call,expect,fixture,users,pst,report});
  await runTerrainWarehouseScenarios({pool,call,stock,count,expect,fixture,users,bus,pst,report});
  await runRequirementSearchScenarios({pool,call,expect,fixture,users,pst,report});
  // Independent scanner confirmation fixture in this ephemeral PostgreSQL only.
  const scanSerie='7499988';
  await pool.query("INSERT INTO pmp.validadores(serie,modelo) VALUES($1,'CVB45')",[scanSerie]);
  const scannerOrder=(await pool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,ubicacion_id,bus_ppu,terminal_id,pst_codigo)
   VALUES('VALIDADOR',$1,'Prueba salida scanner',3,1,$2,$3,$4) RETURNING codigo_os`,[scanSerie,bus,fixture.terminalId,pst])).rows[0].codigo_os;
  const scannerExit=expect(await call('logistica','POST','/api/bodega/dispatch-lab/validar',{
   codigo_os:scannerOrder,tipo_equipo:'VALIDADOR',codigo:scanSerie,origen_captura:'SCANNER',
   lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(7).fill(10)}
  }),200,'validación scanner salida independiente');
  expect(await call('logistica','PUT','/api/bodega/dispatch-lab',{codigo_os:scannerOrder,validacion_id:scannerExit.validacion.id}),200,'confirmación scanner');
  await scan(baseUrl,'admin',scanSerie,'LABORATORIO');
  const labQueue=expect(await call('admin','GET','/api/lab/queue/VALIDADOR'),200,'cola laboratorio');
  assert.ok(labQueue.some(o=>o.codigo_os===scannerOrder));
  const queueItem=labQueue.find(o=>o.codigo_os===scannerOrder);
  assert.equal(queueItem.modelo,'CVB45');assert.ok(queueItem.fecha_ingreso_laboratorio);
  assert.equal(queueItem.tecnico_laboratorio_id,null);assert.ok(queueItem.ubicacion);
  const beforeAssign=(await pool.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1',[scannerOrder])).rows[0];
  expect(await call('admin','PUT','/api/lab/assign',{codigo_os:scannerOrder,tecnico_id:users.lab.id}),200,'asignar carga conserva estado');
  const afterAssign=(await pool.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1',[scannerOrder])).rows[0];
  for(const key of ['codigo_os','estado_id','ubicacion_id','validador_serie','caso_id','falla'])assert.equal(afterAssign[key],beforeAssign[key]);
  const assignedItem=expect(await call('admin','GET','/api/lab/queue/VALIDADOR'),200,'carga asignada').find(o=>o.codigo_os===scannerOrder);
  assert.equal(assignedItem.tecnico_laboratorio_id,users.lab.id);assert.ok(assignedItem.tecnico_laboratorio);
  assert.equal(assignedItem.fecha_ingreso_laboratorio,queueItem.fecha_ingreso_laboratorio,'asignación no cambia fecha real de ingreso');
  report.steps.push({action:'Consulta de carga: modelo, ubicación, ingreso real y nombre técnico; asignar conserva OS y diagnóstico',ok:true});
  assert.equal(queueItem.fuente_ingreso_laboratorio,'RECEPCION_FISICA');
  assert.equal(queueItem.reingreso_laboratorio,false,'evento y auditoría simultánea son un único ingreso');
  const dateClient=await pool.connect();
  try{
   await dateClient.query('BEGIN');
   const dateOrder=(await dateClient.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,ubicacion_id,bus_ppu,terminal_id,pst_codigo,fecha)
    VALUES('VALIDADOR',$1,'Fixture legacy',4,2,$2,$3,$4,NOW()-INTERVAL '10 days') RETURNING codigo_os`,[scanSerie,bus,fixture.terminalId,pst])).rows[0].codigo_os;
   const readDate=async()=>(await dateClient.query(`SELECT ingreso.* FROM pmp.ordenes_servicio o ${labArrivalJoin} WHERE o.codigo_os=$1`,[dateOrder])).rows[0];
   assert.equal((await readDate()).fecha,null);assert.equal((await readDate()).legacy,true);
   const exit=async()=>dateClient.query(`INSERT INTO pmp.flujo_eventos(codigo_os,tipo,usuario_id,rol,fecha) VALUES($1,'SALIDA_BODEGA_LABORATORIO',$2,'logistica',clock_timestamp())`,[dateOrder,users.logistica.id]);
   const receive=async()=>dateClient.query(`INSERT INTO pmp.escaneos_equipos(codigo_leido,tipo_codigo,estacion,tipo_equipo,serie,codigo_os,ubicacion_id,usuario_id,rol,resultado,fecha)
    VALUES($1,'SERIE','LABORATORIO','VALIDADOR',$1,$2,2,$3,'admin','VALIDADO',clock_timestamp())`,[scanSerie,dateOrder,users.admin.id]);
   await exit();assert.equal((await readDate()).en_transito,true);assert.equal((await readDate()).fecha,null);
   await receive();const first=await readDate();assert.ok(first.fecha);assert.equal(first.en_transito,false);
   await receive();assert.equal((await readDate()).fecha.getTime(),first.fecha.getTime(),'rescan no reinicia ciclo SLA');
   await exit();assert.equal((await readDate()).fecha,null,'salida del nuevo ciclo invalida recepción anterior');
   await receive();const second=await readDate();assert.ok(second.fecha>first.fecha);assert.equal(second.reingreso,true);
  }finally{await dateClient.query('ROLLBACK');dateClient.release();}
  report.steps.push({action:'Physical-first laboratorio: salida sin carga/SLA, recepción, asignación, último ciclo y fallback legacy',ok:true});
  const ownQueue=expect(await call('lab','GET','/api/lab/queue/VALIDADOR'),200,'bandeja propia laboratorio');
  assert.ok(ownQueue.some(o=>o.codigo_os===scannerOrder));
  assert.ok(ownQueue.every(o=>o.tecnico_laboratorio_id===users.lab.id));
  // Reuse an existing isolated fixture; OS/case relationships remain immutable.
  const doneFixture=repair;
  await pool.query('UPDATE pmp.ordenes_servicio SET estado_id=10,ubicacion_id=2,tecnico_laboratorio_id=$2 WHERE codigo_os=$1',[doneFixture,users.lab.id]);
  const privateFixture=(await pool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,ubicacion_id,bus_ppu,terminal_id,pst_codigo)
    SELECT tipo_equipo,validador_serie,'Fixture ajena',10,2,bus_ppu,terminal_id,pst_codigo FROM pmp.ordenes_servicio WHERE codigo_os=$1 RETURNING codigo_os`,[repair])).rows[0].codigo_os;
  const ownDone=expect(await call('lab','GET','/api/lab/completed'),200,'terminados propios');
  assert.ok(ownDone.every(o=>o.tecnico_laboratorio_id===users.lab.id));assert.ok(!ownDone.some(o=>o.codigo_os===privateFixture));
  const completed=ownDone.find(o=>o.codigo_os===doneFixture);assert.ok(completed);assert.equal(completed.estado_id,10);assert.ok(completed.modelo);assert.ok(completed.referencia_ar);
  report.steps.push({action:'Mi carga: lectura de activos y terminados limitada al técnico; modelo, AR y estado conservados',ok:true});
  // Subsequent QA-return cycle, all mutations confined to this ephemeral fixture.
  await pool.query('UPDATE pmp.ordenes_servicio SET estado_id=3,ubicacion_id=1,es_aprobado_qa=false WHERE codigo_os=$1',[scannerOrder]);
  const reentryEvidence=expect(await call('logistica','POST','/api/bodega/dispatch-lab/validar',{
    codigo_os:scannerOrder,tipo_equipo:'VALIDADOR',codigo:scanSerie,origen_captura:'MANUAL_AUTORIZADO',
    presencia_fisica_confirmada:true,motivo:'Fixture reingreso tras QA'
  }),200,'validar reingreso');
  expect(await call('logistica','PUT','/api/bodega/dispatch-lab',{codigo_os:scannerOrder,validacion_id:reentryEvidence.validacion.id}),200,'salida nuevo ciclo');
  expect(await call('admin','PUT','/api/lab/assign',{codigo_os:scannerOrder,tecnico_id:users.lab.id}),409,'recepción anterior no habilita reasignación');
  assert.ok(!expect(await call('lab','GET','/api/lab/queue/VALIDADOR'),200,'no trabajo durante tránsito').some(o=>o.codigo_os===scannerOrder));
  await scan(baseUrl,'admin',scanSerie,'LABORATORIO');
  const reentered=expect(await call('admin','GET','/api/lab/queue/VALIDADOR'),200,'reingreso disponible').find(o=>o.codigo_os===scannerOrder);
  assert.ok(new Date(reentered.fecha_ingreso_laboratorio)>new Date(queueItem.fecha_ingreso_laboratorio));
  assert.equal(reentered.reingreso_laboratorio,true);assert.equal(reentered.tecnico_laboratorio_id,null);
  expect(await call('admin','PUT','/api/lab/assign',{codigo_os:scannerOrder,tecnico_id:users.lab.id}),200,'reasignar recibido');
  const ownReentry=expect(await call('lab','GET','/api/lab/queue/VALIDADOR'),200,'trabajo habilitado').find(o=>o.codigo_os===scannerOrder);
  assert.equal(ownReentry.recepcion_laboratorio_confirmada,true);
  const custodyHistory=expect(await call('logistica','GET',`/api/bridge/activos/VALIDADOR/${scanSerie}/historial`),200,'cadena custodia');
  for(const type of ['SALIDA_BODEGA_LABORATORIO','RECEPCION_LABORATORIO_CONFIRMADA','TECNICO_LABORATORIO_ASIGNADO'])assert.ok(custodyHistory.eventos.some(e=>e.codigo_os===scannerOrder&&e.tipo===type));
  report.steps.push({action:'Reingreso real por endpoints: salida invalida recepción previa, nueva recepción inicia ciclo, reasignación y apertura habilitadas',ok:true});

  report.steps.push({action:'Scanner confirma salida en misma OS y queda visible en cola de Laboratorio e historial',ok:true});

  await runLabWorkScenarios({pool,call,expect,scan,baseUrl,fixture,users,pst,bus,report});

}
