import assert from 'node:assert/strict';
import sharp from 'sharp';
import { operatingAssetsSql } from '../src/services/logisticsPresentation.js';
import { confirmTerrainWithdrawal } from '../src/services/terrainWithdrawal.js';
export async function runWithdrawalCameraScenarios({pool,call,expect,fixture,users,pst,report}){
  const bus='E2ECAM01',serie='7490911';
  await pool.query('INSERT INTO pmp.buses(ppu) VALUES($1)',[bus]);
  await pool.query("INSERT INTO pmp.validadores(serie,modelo,marca) VALUES($1,'CVB45','Mikroelektronika'),('7490912','CVB45','Mikroelektronika')",[serie]);
  await pool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo)
    VALUES('VALIDADOR',$1,'Instalado',12,$2,$3,$4)`,[serie,bus,fixture.terminalId,pst]);
  const req=expect(await call('logistica','POST','/api/requerimientos',{origen:'ARANDA',referencia_externa:'AR-99100911',tipo_equipo:'VALIDADOR',serie,bus_ppu:bus,terminal_id:fixture.terminalId,pst_codigo:pst,falla:'Falla QR',fecha_requerimiento:new Date().toISOString()}),201,'requerimiento aislado cámara');
  const codigo_os=req.os.codigo_os;
  expect(await call('logistica','POST','/api/os/asignar-retiro',{codigo_os,tecnico_terreno_id:users.terreno.id}),200,'asignar cámara');
  const context=expect(await call('terreno','GET','/api/os/mis-ordenes'),200,'contexto completo').find(o=>o.codigo_os===codigo_os);
  for(const key of ['modelo','marca','terminal','operador','referencia_ar','serie','bus_ppu','tecnico'])assert.ok(context[key],key);
  const validate=(codigo_leido=serie,method='SCAN',extra={})=>call('terreno','POST','/api/os/validar-identidad-retiro',{codigo_os,codigo_leido,metodo_validacion:method,...extra});
  const scans=Number((await pool.query('SELECT count(*) FROM pmp.escaneos_equipos')).rows[0].count);
  const wrong=expect(await validate('7490912'),200,'equipo distinto');assert.equal(wrong.coincide,false);
  const base={codigo_os,tipo_equipo:'VALIDADOR',serie,bus_ppu:bus,retiro_confirmado:true,evidencia:'Daño observado en terreno',pod:false,validacion_id:wrong.validacion_id};
  expect(await call('terreno','POST','/api/os/confirmar-retiro',base),422,'discrepancia bloquea retiro');
  const discrepancy={codigo_os,validacion_id:wrong.validacion_id,observacion:'Equipo distinto encontrado en bus'};
  const d=expect(await call('terreno','POST','/api/os/discrepancia-retiro',discrepancy),200,'registrar discrepancia');
  assert.equal(expect(await call('terreno','POST','/api/os/discrepancia-retiro',discrepancy),200,'reintento discrepancia').id,d.id);
  assert.ok((await pool.query(operatingAssetsSql)).rows.some(a=>a.serie===serie));
  expect(await validate(serie,'MANUAL'),422,'contingencia requiere motivo');
  const contingency={motivo_manual:'QR_ILEGIBLE',observacion_manual:'Etiqueta dañada, se verificó serie visible'};
  assert.equal(expect(await validate(serie+' ','MANUAL',contingency),200,'manual exacto').coincide,false);
  const manual=expect(await validate(serie,'MANUAL',contingency),200,'contingencia válida');assert.equal(manual.metodo_validacion,'MANUAL');
  const ok=expect(await validate(),200,'identidad cámara válida');assert.equal(ok.coincide,true);

  const stateBeforeRescan=(await pool.query('SELECT to_jsonb(o) AS data FROM pmp.ordenes_servicio o WHERE codigo_os=$1',[codigo_os])).rows[0].data;
  for(let i=0;i<3;i++)assert.equal(expect(await validate(),200,'rescan idempotente').validacion_id,ok.validacion_id);
  assert.equal(Number((await pool.query("SELECT count(*) FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='VALIDACION_IDENTIDAD_RETIRO' AND metadata->>'metodo_validacion'='SCAN' AND metadata->>'coincide'='true'",[codigo_os])).rows[0].count),1);
  assert.deepEqual((await pool.query('SELECT to_jsonb(o) AS data FROM pmp.ordenes_servicio o WHERE codigo_os=$1',[codigo_os])).rows[0].data,stateBeforeRescan);
  expect(await call('terreno','POST','/api/os/confirmar-retiro',{...base,validacion_id:manual.validacion_id}),409,'validación anterior bloqueada');
  const payload={...base,validacion_id:ok.validacion_id};
  for(const extra of [{pod:null},{pod:'false'},{retiro_confirmado:false},{pod:true},{pod:true,categoria_pod:'GOLPE'},{pod:true,categoria_pod:'GOLPE',fotografias:[{origen:'CAMARA',base64:'YWJj'}]}])
    expect(await call('terreno','POST','/api/os/confirmar-retiro',{...payload,...extra}),422,'validación retiro / PoD');
  // Roll back both the movement and event if storage fails after the OS update.
  const failingPool={connect:async()=>{const c=await pool.connect();return {release:()=>c.release(),query:(sql,args)=>{if(sql.includes('INSERT INTO pmp.flujo_eventos')&&args?.[2]==='RETIRO_TERRENO_CONFIRMADO')throw Error('evidence storage failure');return c.query(sql,args);}};}};
  await assert.rejects(()=>confirmTerrainWithdrawal(failingPool,payload,{id:users.terreno.id,rol:'tecnico_terreno'}),/storage failure/);
  assert.equal((await pool.query('SELECT estado_id FROM pmp.ordenes_servicio WHERE codigo_os=$1',[codigo_os])).rows[0].estado_id,1);
  assert.equal(Number((await pool.query("SELECT count(*) FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='RETIRO_TERRENO_CONFIRMADO'",[codigo_os])).rows[0].count),0);
  const photo=(await sharp({create:{width:80,height:80,channels:3,background:'#b45309'}}).jpeg().toBuffer()).toString('base64');
  const podPayload={...payload,pod:true,categoria_pod:'GOLPE',fotografias:[{origen:'CAMARA',base64:photo}]};
  const kpiBefore=expect(await call('admin','GET','/api/dashboard/summary'),200,'KPI antes').kpis;
  const results=await Promise.all([call('terreno','POST','/api/os/confirmar-retiro',podPayload),call('terreno','POST','/api/os/confirmar-retiro',podPayload)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const order=(await pool.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1',[codigo_os])).rows[0];
  assert.equal(order.estado_id,2);assert.equal(order.codigo_os,'MV-99100911');assert.equal(order.es_pod,false);
  assert.equal(Number((await pool.query('SELECT count(*) FROM pmp.ordenes_servicio WHERE caso_id=$1',[req.caso.id])).rows[0].count),1,'no PDV ni IN automático');
  const event=(await pool.query("SELECT * FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='RETIRO_TERRENO_CONFIRMADO'",[codigo_os])).rows;
  assert.equal(event.length,1);assert.equal(event[0].metadata.fotografias.length,1);assert.equal(event[0].metadata.metodo_validacion,'SCAN');
  assert.equal(event[0].metadata.coincide,true);assert.equal(event[0].metadata.esperado.serie,serie);assert.equal(event[0].metadata.encontrado.serie,serie);
  assert.equal(event[0].usuario_id,users.terreno.id);assert.equal(event[0].serie,serie);assert.equal(event[0].metadata.discrepancias[0],d.id);
  assert.equal(Number((await pool.query('SELECT count(*) FROM pmp.escaneos_equipos')).rows[0].count),scans,'no falsificar evidencia Bodega');
  assert.ok(!(await pool.query(operatingAssetsSql)).rows.some(a=>a.serie===serie));
  assert.ok(expect(await call('logistica','GET','/api/bodega/queue'),200,'retiro llega a recepción').some(o=>o.codigo_os===codigo_os));
  assert.equal(expect(await call('admin','GET','/api/dashboard/summary'),200,'KPI después').kpis.totalEnRuta,kpiBefore.totalEnRuta);
  for(const url of [`/api/bridge/activos/VALIDADOR/${serie}/historial`,`/api/requerimientos/${req.caso.id}`]){
    const history=expect(await call('logistica','GET',url),200,'historial retiro');

    assert.equal(history.ordenes.find(o=>o.codigo_os===codigo_os).ubicacion,'En tránsito hacia Bodega');
    assert.equal(history.eventos.filter(e=>e.tipo==='VALIDACION_IDENTIDAD_RETIRO'&&(e.detalle.metadata||e.detalle).coincide).length,2);
    const auditIds=(await pool.query("SELECT id FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='VALIDACION_IDENTIDAD_RETIRO'",[codigo_os])).rows.map(r=>'flujo:'+r.id).sort();
    const presentedIds=history.eventos.filter(e=>e.tipo==='VALIDACION_IDENTIDAD_RETIRO').flatMap(e=>(e.detalle.intentos||[e]).map(attempt=>attempt.id)).sort();
    assert.deepEqual(presentedIds,auditIds,'cada intento original sigue accesible en el detalle');
    assert.ok(history.eventos.filter(e=>e.tipo==='VALIDACION_IDENTIDAD_RETIRO'&&!(e.detalle.metadata||e.detalle).coincide).every(e=>e.titulo==='Validación de identidad no coincidente'));
    assert.equal((await pool.query('SELECT estado_id FROM pmp.ordenes_servicio WHERE codigo_os=$1',[codigo_os])).rows[0].estado_id,2);
    for(const e of history.eventos)for(const c of e.cambios||[]){
      if(c.campo==='Estado')assert.ok(!['EN_RUTA','EN_TRANSITO','PENDIENTE_RETIRO'].includes(c.actual));
    }
    const withdrawal=history.eventos.find(e=>e.tipo==='RETIRO_TERRENO_CONFIRMADO');assert.equal(withdrawal.titulo,'Retiro físico confirmado');
    assert.match(withdrawal.descripcion,/escaneo con cámara/);assert.match(withdrawal.descripcion,/PoD: Sí/);
    assert.ok((withdrawal.detalle.metadata||withdrawal.detalle).fotografias[0].sha256);
    assert.ok(history.eventos.some(e=>e.tipo==='DISCREPANCIA_RETIRO_TERRENO'));assert.ok(history.eventos.some(e=>e.tipo==='POD_DETECTADO_TERRENO'));
  }

  for(const optionalPhoto of [false,true]){
    const normalSerie=optionalPhoto?'7490914':'7490913',normalBus=optionalPhoto?'E2ENORM2':'E2ENORM1';
    await pool.query('INSERT INTO pmp.buses(ppu) VALUES($1)',[normalBus]);
    await pool.query("INSERT INTO pmp.validadores(serie,modelo,marca) VALUES($1,'CVB45','Mikroelektronika')",[normalSerie]);
    await pool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo)
      VALUES('VALIDADOR',$1,'Instalado',12,$2,$3,$4)`,[normalSerie,normalBus,fixture.terminalId,pst]);
    const normalReq=expect(await call('logistica','POST','/api/requerimientos',{origen:'ARANDA',referencia_externa:optionalPhoto?'AR-99100914':'AR-99100913',tipo_equipo:'VALIDADOR',serie:normalSerie,bus_ppu:normalBus,terminal_id:fixture.terminalId,pst_codigo:pst,falla:'Falla QR',fecha_requerimiento:new Date().toISOString()}),201,'retiro normal aislado');
    const normalCode=normalReq.os.codigo_os;
    expect(await call('logistica','POST','/api/os/asignar-retiro',{codigo_os:normalCode,tecnico_terreno_id:users.terreno.id}),200,'asignar retiro normal');
    const identity=expect(await call('terreno','POST','/api/os/validar-identidad-retiro',{codigo_os:normalCode,codigo_leido:normalSerie,metodo_validacion:'SCAN'}),200,'SCAN retiro normal');
    assert.equal(identity.coincide,true);
    expect(await call('terreno','POST','/api/os/confirmar-retiro',{codigo_os:normalCode,tipo_equipo:'VALIDADOR',serie:normalSerie,bus_ppu:normalBus,validacion_id:identity.validacion_id,retiro_confirmado:true,pod:false,categoria_pod:'GOLPE',evidencia:'',fotografias:optionalPhoto?[{origen:'CAMARA',base64:photo}]:[]}),200,'PoD No sin observación con foto opcional');
    const normalEvents=(await pool.query("SELECT tipo,metadata FROM pmp.flujo_eventos WHERE codigo_os=$1",[normalCode])).rows;
    const normalEvent=normalEvents.find(e=>e.tipo==='RETIRO_TERRENO_CONFIRMADO');
    assert.equal(normalEvent.metadata.pod,false);assert.equal(normalEvent.metadata.categoria_pod,null);
    assert.equal(normalEvent.metadata.fotografias.length,optionalPhoto?1:0);
    assert.ok(!normalEvents.some(e=>e.tipo==='POD_DETECTADO_TERRENO'));
    assert.equal((await pool.query('SELECT estado_id FROM pmp.ordenes_servicio WHERE codigo_os=$1',[normalCode])).rows[0].estado_id,2);
  }

  const receiptCode='MV-99100913',receiptSeries='7490913';
  const badgeCheck=async()=>{
    const queue=expect(await call('logistica','GET','/api/bodega/queue'),200,'cola de bodega');
    const lanes=queue.filter(o=>[2,11].includes(o.estado_id)).length+
      queue.filter(o=>o.estado_id===3&&(o.es_aprobado_qa===false||!o.fue_laboratorio)).length+
      queue.filter(o=>o.estado_id===3&&o.fue_laboratorio&&o.es_aprobado_qa==null).length;
    assert.equal(expect(await call('logistica','GET','/api/dashboard/badges'),200,'badge de bodega').bodega,lanes);
    return queue;
  };
  const receiptContext=(await badgeCheck()).find(o=>o.codigo_os===receiptCode);
  for(const key of ['modelo','marca','terminal','operador','tecnico_retiro','codigo_caso','referencia_ar'])assert.ok(receiptContext[key],key);
  const snapshot=async()=>(await pool.query('SELECT to_jsonb(o) AS data FROM pmp.ordenes_servicio o WHERE codigo_os=$1',[receiptCode])).rows[0].data;
  const untouched=await snapshot();
  const receiptBody={codigo_os:receiptCode,tipo_equipo:'VALIDADOR',codigo:receiptSeries,origen_captura:'SCANNER'};
  expect(await call('logistica','PUT','/api/bodega/receive',{codigo_os:receiptCode}),409,'retiro no sustituye recepción');
  expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',receiptBody),422,'digitación sin evidencia de scanner');
  expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',{...receiptBody,lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(7).fill(200)}}),422,'digitación lenta bloqueada');
  const receiptProof={tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(7).fill(10)};
  const mismatch=expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',{...receiptBody,codigo:'7490912',lectura_scanner:receiptProof}),200,'discrepancia recepción');
  assert.equal(mismatch.coincide,false);assert.equal(mismatch.elegible,false);
  assert.ok((await pool.query("SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='DISCREPANCIA_RECEPCION_BODEGA'",[receiptCode])).rowCount);
  assert.deepEqual(await snapshot(),untouched,'validación incorrecta no mueve ningún equipo');
  let receipt=expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',{...receiptBody,lectura_scanner:receiptProof}),200,'nueva evidencia scanner en bodega');
  assert.equal(receipt.coincide,true);
  assert.deepEqual(await snapshot(),untouched,'validar y cancelar no cambia estado ni ubicación');
  await badgeCheck();
  expect(await call('admin','PUT','/api/bodega/receive',{codigo_os:receiptCode,escaneo_id:receipt.escaneo.id}),409,'evidencia de otro usuario bloqueada');
  expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',{...receiptBody,codigo:'7490912',lectura_scanner:receiptProof}),200,'discrepancia posterior');
  expect(await call('logistica','PUT','/api/bodega/receive',{codigo_os:receiptCode,escaneo_id:receipt.escaneo.id}),409,'discrepancia invalida evidencia anterior');
  receipt=expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',{...receiptBody,lectura_scanner:receiptProof}),200,'nueva lectura después de discrepancia');
  const ordersBeforeReceipt=Number((await pool.query('SELECT count(*) FROM pmp.ordenes_servicio')).rows[0].count);
  const receives=await Promise.all([1,2].map(()=>call('logistica','PUT','/api/bodega/receive',{codigo_os:receiptCode,escaneo_id:receipt.escaneo.id})));
  assert.deepEqual(receives.map(r=>r.status).sort(),[200,409]);
  const received=await snapshot();assert.equal(received.estado_id,3);
  assert.equal((await pool.query('SELECT tipo FROM pmp.ubicaciones WHERE id=$1',[received.ubicacion_id])).rows[0].tipo,'BODEGA');
  assert.equal(Number((await pool.query('SELECT count(*) FROM pmp.ordenes_servicio')).rows[0].count),ordersBeforeReceipt,'no nueva OS ni IN');
  const receiptHistory=expect(await call('logistica','GET','/api/bridge/activos/VALIDADOR/'+receiptSeries+'/historial'),200,'historial recepción');
  assert.equal(receiptHistory.eventos.filter(e=>e.tipo==='RECEPCION_TERRENO_BODEGA').length,1);
  assert.equal(receiptHistory.eventos.find(e=>e.tipo==='RECEPCION_TERRENO_BODEGA').detalle.metadata.origen_captura,'SCANNER');
  await badgeCheck();
  report.steps.push({name:'Recepción física nueva, discrepancia, cancelar sin movimiento, confirmación transaccional y badge exacto',ok:true});
  report.steps.push({name:'SCAN + PoD No sin observación, sin foto y con foto opcional',ok:true});
  report.steps.push({name:'retiro cámara / discrepancia / contingencia / PoD / rollback / concurrencia / historiales',ok:true});
}
