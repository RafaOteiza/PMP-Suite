import {runLabWorkScenarios} from './lab_work_scenarios.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runQaCustodyScenarios} from './qa_custody_scenarios.mjs';
import {labArrivalJoin} from '../src/services/labArrival.js';

// Called only by the disposable PostgreSQL harness. No habitual URL or data is accepted.
export async function consolidationScenarios({pool,base,users,order,asset,ctx,results}){
 const connection=await pool.query('SELECT inet_server_port() port');assert.notEqual(connection.rows[0].port,5432);
 const actors={admin:'admin',jefe_laboratorio:'jefe_laboratorio',logistica:'logistica',terreno:'tecnico_terreno',lab:'tecnico_laboratorio',qa:'qa',qa2:'qa2',gerente:'gerente'};
 const user=key=>users.find(u=>(u.fixtureKey||u.rol)===actors[key]);
 const call=async(actor,method,path,body)=>{
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(actor?{'x-fixture-role':actors[actor]||actor}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,data:await r.json()};
 };
 const expect=(r,status,label)=>{assert.equal(r.status,status,`${label}: ${JSON.stringify(r.data)}`);return r.data;};
 const ok=async(actor,method,path,body,status=200)=>expect(await call(actor,method,path,body),status,path);
 const row=async()=>(await pool.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1',[order])).rows[0];
 const events=async type=>Number((await pool.query('SELECT count(*) n FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo=$2',[order,type])).rows[0].n);
 const physical={tipo_equipo:asset.tipo_equipo,codigo:asset.serie,origen_captura:'SCANNER',lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(asset.serie.length).fill(10)}};
 const manual={...physical,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true,motivo:'Prueba aislada de contingencia'};
 const custody=(purpose,action)=>`/api/lab/custody/${order}/${purpose}/${action}`;
 const warehouseReceipt=async()=>{const e=await ok('logistica','POST','/api/bodega/recepcion-terreno/validar',{codigo_os:order,...manual});const body={codigo_os:order,validacion_id:e.validacion.id};await ok('logistica','PUT','/api/bodega/receive',body);await ok('logistica','PUT','/api/bodega/receive',body);};
 const warehouseExit=async()=>{const e=await ok('logistica','POST','/api/bodega/dispatch-lab/validar',{codigo_os:order,...manual});const body={codigo_os:order,validacion_id:e.validacion.id};await Promise.all([1,2].map(()=>ok('logistica','PUT','/api/bodega/dispatch-lab',body)));return e;};
 // Same persisted asset; no manufactured initial state in the journey.
 const before=await row();assert.equal(before.estado_id,1);assert.equal(before.bus_ppu,ctx.bus_ppu);
 assert.ok(!(await ok('logistica','GET','/api/bodega/queue')).some(o=>o.codigo_os===order));
 await ok('terreno','GET','/api/os/'+order,undefined,403);
 await ok('logistica','POST','/api/os/asignar-retiro',{codigo_os:order,tecnico_terreno_id:user('terreno').id});
 const identified=await ok('terreno','POST','/api/os/validar-identidad-retiro',{codigo_os:order,codigo_leido:asset.serie,metodo_validacion:'SCAN'});
 const repeated=await ok('terreno','POST','/api/os/validar-identidad-retiro',{codigo_os:order,codigo_leido:asset.serie,metodo_validacion:'SCAN'});
 assert.equal(repeated.validacion_id,identified.validacion_id);
 await ok('terreno','POST','/api/os/confirmar-retiro',{codigo_os:order,...asset,bus_ppu:ctx.bus_ppu,retiro_confirmado:true,pod:false,fotografias:[],validacion_id:identified.validacion_id});
 assert.equal((await row()).estado_id,2);await warehouseReceipt();
 const dispatched=await warehouseExit();assert.equal((await row()).ubicacion_id,null);assert.equal(await events('SALIDA_BODEGA_LABORATORIO'),1);
 const getArrival=async()=>(await pool.query(`SELECT ingreso.* FROM pmp.ordenes_servicio o ${labArrivalJoin} WHERE o.codigo_os=$1`,[order])).rows[0];
 assert.equal((await getArrival()).fecha,null);assert.equal((await getArrival()).en_transito,true);
 assert.ok(!(await ok('admin','GET','/api/lab/queue/VALIDADOR')).some(o=>o.codigo_os===order));
 const badgesBefore=await ok('admin','GET','/api/dashboard/badges');
 await ok('jefe_laboratorio','PUT','/api/lab/assign',{codigo_os:order,tecnico_id:user('lab').id},409);
 await ok('jefe_laboratorio','POST','/api/equipment-scan/confirm',{codigo:asset.serie,estacion:'LABORATORIO'},409);
 await ok('jefe_laboratorio','POST',custody('RECEPCION','confirmar'),{validacion_id:dispatched.validacion.id},409);
 for(const actor of ['admin','logistica','terreno','lab','qa','gerente'])await ok(actor,'POST',custody('RECEPCION','validar'),manual,403);
 await ok(null,'POST',custody('RECEPCION','validar'),manual,401);
 await ok('jefe_laboratorio','POST',custody('RECEPCION','validar'),{...physical,lectura_scanner:undefined},422);
 const expectedRow=await row();let e=await ok('jefe_laboratorio','POST',custody('RECEPCION','validar'),physical);
 assert.deepEqual(await row(),expectedRow,'validar/cancelar no altera OS ni custodia');
 const bad=await ok('jefe_laboratorio','POST',custody('RECEPCION','validar'),{...physical,codigo:'7400000'});assert.equal(bad.coincide,false);
 await ok('jefe_laboratorio','POST',custody('RECEPCION','confirmar'),{validacion_id:e.validacion.id},409);
 for(const patch of [{codigo:'otra'},{tipo_equipo:'CONSOLA'},{presencia_fisica_confirmada:false},{motivo:''}])await ok('jefe_laboratorio','POST',custody('RECEPCION','validar'),{...manual,...patch},422);
 e=await ok('jefe_laboratorio','POST',custody('RECEPCION','validar'),manual);
 await pool.query(`CREATE FUNCTION pmp.custody_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tipo='RECEPCION_LABORATORIO_CONFIRMADA' THEN RAISE EXCEPTION 'Isolated custody rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER custody_fail BEFORE INSERT ON pmp.flujo_eventos FOR EACH ROW EXECUTE FUNCTION pmp.custody_fail()`);
 await ok('jefe_laboratorio','POST',custody('RECEPCION','confirmar'),{validacion_id:e.validacion.id},500);assert.deepEqual(await row(),expectedRow);
 assert.equal(await events('RECEPCION_LABORATORIO_CONFIRMADA'),0);
 await pool.query('DROP TRIGGER custody_fail ON pmp.flujo_eventos; DROP FUNCTION pmp.custody_fail()');
 const receive={validacion_id:e.validacion.id};await Promise.all([1,2].map(()=>ok('jefe_laboratorio','POST',custody('RECEPCION','confirmar'),receive)));
 await ok('jefe_laboratorio','POST',custody('RECEPCION','confirmar'),receive);assert.equal(await events('RECEPCION_LABORATORIO_CONFIRMADA'),1);
 assert.equal((await row()).estado_id,4);assert.notEqual((await row()).ubicacion_id,null);
 const receipt=(await getArrival()).fecha;assert.ok(receipt);assert.equal((await getArrival()).en_transito,false);
 assert.equal((await ok('admin','GET','/api/dashboard/badges')).lab,badgesBefore.lab+1);
 const scan=(await pool.query("SELECT metadata FROM pmp.escaneos_equipos WHERE codigo_os=$1 AND estacion='LABORATORIO' ORDER BY id DESC LIMIT 1",[order])).rows[0];assert.equal(scan.metadata.origen_captura,'MANUAL_AUTORIZADO');
 await ok('jefe_laboratorio','PUT','/api/lab/assign',{codigo_os:order,tecnico_id:user('qa').id},422);
 await ok('jefe_laboratorio','PUT','/api/lab/assign',{codigo_os:order,tecnico_id:user('lab').id});assert.deepEqual((await getArrival()).fecha,receipt);
 await ok('lab','GET','/api/os/'+order);await ok('lab','GET','/api/lab/work/'+order);
 await ok('lab','PUT','/api/lab/move',{codigo_os:order,nuevo_estado_id:5});
 await ok('lab','POST','/api/lab/finish',{codigo_os:order,trabajo:{diagnostico:{resultado:'CONFIRMADA',falla_real:'Falla QR'},acciones:['Limpieza Interna'],pruebas:[{nombre:'Manual',resultado:'APROBADA'}],resultado:'REPARADO'}});
 for(const path of ['/api/lab/dispatch-qa','/api/admin/dispatch'])await ok('jefe_laboratorio','POST',path,{codigos:[order],codigos_os:[order]},410);
 await ok('jefe_laboratorio','POST',custody('SALIDA','confirmar'),receive,409);
 const out=await ok('jefe_laboratorio','POST',custody('SALIDA','validar'),physical);assert.equal((await row()).estado_id,10);
 await Promise.all([1,2].map(()=>ok('jefe_laboratorio','POST',custody('SALIDA','confirmar'),{validacion_id:out.validacion.id})));
 assert.equal((await row()).estado_id,11);assert.equal((await row()).ubicacion_id,null);assert.equal(await events('SALIDA_LABORATORIO_BODEGA'),1);
 assert.ok(!(await ok('admin','GET','/api/lab/completed')).some(o=>o.codigo_os===order));
 await ok('lab','PUT','/api/lab/move',{codigo_os:order,nuevo_estado_id:5},409);
 results.checks.push('Custodia Lab: evidencia propia, roles, propósito/ciclo, discrepancias, rollback, doble clic, reintento, recepción y salida separadas, SLA y contadores');
 // Autonomous QA covers rejection without PoD, return to Lab, a new physical receipt and new independent QA tests.
 const scanLab=async(_base,actor,series,station)=>{
  assert.equal(station,'LABORATORIO');const ev=await ok(actor,'POST',custody('RECEPCION','validar'),{...physical,codigo:series});
  await ok(actor,'POST',custody('RECEPCION','confirmar'),{validacion_id:ev.validacion.id});
 };
 const fixtureUsers=Object.fromEntries(Object.keys(actors).map(k=>[k,user(k)]));
 const qaReport={steps:[]};await runQaCustodyScenarios({pool,call,expect,scan:scanLab,baseUrl:base,users:fixtureUsers,report:qaReport,repair:order,series:asset.serie});
 assert.ok((await getArrival()).fecha>receipt);await warehouseReceipt();
 results.checks.push(...qaReport.steps.map(s=>s.action));
 const linked={...ctx,contexto_instalacion:'REQUERIMIENTO',caso_id:before.caso_id,os_origen:order};
 const ready=await ok('logistica','POST','/api/bodega/despacho/validar',{...linked,...manual});
 const sent=await ok('logistica','POST','/api/bodega/despacho/confirmar',{...linked,validacion_id:ready.validacion.id},201);
 await ok('terreno','POST','/api/os/completar-instalacion',{codigo_os:sent.os.codigo_os,operativo:true,bus_ppu:ctx.bus_ppu});
 assert.equal((await row()).estado_id,13);assert.ok(sent.os.codigo_os.startsWith('IN-'));
 for(const method of ['GET']){const history=await ok('admin',method,`/api/bridge/activos/${asset.tipo_equipo}/${asset.serie}/historial`);assert.ok(history.eventos.some(e=>e.tipo==='RECEPCION_LABORATORIO_CONFIRMADA'));}
 await ok('logistica','PUT','/api/bodega/asignar',{},410);await ok('logistica','PUT','/api/bodega/repuestos/1/stock',{nuevo_stock:900},409);
 results.checks.push('Recorrido HTTP completo desde alta/nueva IN hasta falla, retiro, Lab, rechazo QA no PoD, segundo ciclo, QA Operativo y nueva instalación vinculada');
 const isolatedUsers=Object.fromEntries(Object.keys(actors).map(key=>[key,user(key)]));
 const receiveLab=async(_base,actor,series)=>{
  const found=(await pool.query("SELECT codigo_os,tipo_equipo FROM pmp.ordenes_servicio WHERE COALESCE(validador_serie,consola_serie)=$1 AND estado_id=2 ORDER BY fecha DESC LIMIT 1",[series])).rows[0];assert.ok(found);
  const path=`/api/lab/custody/${found.codigo_os}/RECEPCION/`;
  const evidence=await ok(actor,'POST',path+'validar',{tipo_equipo:found.tipo_equipo,codigo:series,origen_captura:'SCANNER',lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(series.length).fill(10)}});
  return ok(actor,'POST',path+'confirmar',{validacion_id:evidence.validacion.id});
 };
 // Fixture-only catalog copy uses explicit ids; advance its disposable sequence.
 await pool.query("SELECT setval(pg_get_serial_sequence('pmp.repuestos','id'),(SELECT max(id) FROM pmp.repuestos))");
 const partReport={steps:[]};
 await runLabWorkScenarios({pool,call,expect,scan:receiveLab,baseUrl:base,fixture:{terminalId:ctx.terminal_id},users:isolatedUsers,pst:ctx.pst_codigo,bus:ctx.bus_ppu,report:partReport});
 results.checks.push(...partReport.steps.map(s=>s.action));
 for(const [tipo_equipo,serie,modelo,marca] of [['VALIDADOR','7299551','CVB35','Mikroelektronika'],['VALIDADOR','7599551','CVB45','Mikroelektronika'],['CONSOLA','CON-A9551','N9715','Waysion']]){
  const body={tipo_equipo,serie,origen:'Fixture aislada identidad',fecha_ingreso:'2026-10-08'};
  await ok('logistica','POST','/api/activos',{...body,modelo:'INCORRECTO'},422);
  const asset=await ok('logistica','POST','/api/activos',body,201);assert.equal(asset.modelo,modelo);assert.equal(asset.marca,marca);
  const before=(await pool.query('SELECT count(*)::int n FROM pmp.flujo_eventos')).rows[0].n;
  const read=await ok('logistica','GET',`/api/activos?tipo_equipo=${tipo_equipo}&q=${serie}`);assert.equal(read[0].modelo,modelo);assert.equal(read[0].marca,marca);
  await ok('terreno','GET',`/api/bridge/activos/${tipo_equipo}/${serie}/historial`);
  assert.equal((await pool.query('SELECT count(*)::int n FROM pmp.flujo_eventos')).rows[0].n,before);
 }
 results.checks.push({action:'Identidad API omitida/contradictoria, consulta sin escritura; PoD, solicitud y entrega de repuesto concurrente, stock y ciclos técnicos',ok:true});

}
