import assert from 'node:assert/strict';
import { runManualInitialReception } from './manual_initial_reception_scenarios.mjs';
export async function runMasterScenarios({pool,call,stock,count,expect,scan,baseUrl,fixture,users,bus,pst,history,create,sent,ctx,report}) {
  const counts=async()=>Object.fromEntries(await Promise.all(['validadores','consolas','casos_operacionales','ordenes_servicio','bridge_referencias','flujo_eventos','buses'].map(async t=>[t,await count(t)])));
  const body={origen:'ARANDA',referencia_externa:'AR-00990001',tipo_equipo:'VALIDADOR',serie:'7499001',
    bus_ppu:bus,terminal_id:fixture.terminalId,pst_codigo:pst,falla:'QR',fecha_requerimiento:new Date().toISOString()};
  const before=await counts();
  assert.deepEqual(expect(await call('logistica','GET','/api/activos?tipo_equipo=VALIDADOR&q=7499001'),200,'desconocido'),[]);
  expect(await call('logistica','POST','/api/requerimientos',body),422,'requiere maestro existente');
  expect(await call('logistica','POST','/api/requerimientos',{...body,registrar_activo:true}),422,'alta retirada de requerimientos');
  expect(await call('logistica','POST','/api/requerimientos',{...body,serie:''}),422,'identidad ausente');
  expect(await call('terreno','POST','/api/os/crear',{tipo:'VALIDADOR',serie_equipo:body.serie,bus_ppu:bus,falla:'QR',terminal_id:fixture.terminalId,pst_codigo:pst}),422,'terreno tampoco crea maestro');
  assert.deepEqual(await counts(),before,'sin identidad válida no se muta maestro/caso/OS/Bridge');
  for(const actor of ['terreno','lab','qa']) {
    expect(await call(actor,'POST','/api/activos',{}),403,'rol sin alta');
    expect(await call(actor,'POST','/api/activos/recepcion',{}),403,'rol sin recepción inicial');
    expect(await call(actor,'GET','/api/activos?tipo_equipo=VALIDADOR'),403,'rol sin gestión');
  }
  const registration={tipo_equipo:'VALIDADOR',serie:'7499001',origen:'Compra E2E',fecha_ingreso:new Date().toISOString(),observacion:'Equipo nuevo sin datos técnicos'};
  const newAsset=expect(await call('logistica','POST','/api/activos',registration),201,'alta solo maestro');
  assert.equal(newAsset.modelo,null);assert.equal(newAsset.marca,null);assert.equal(newAsset.estado_actual,'REGISTRADO');
  assert.equal(newAsset.origen_registro,registration.origen);assert.equal(newAsset.observacion_registro,registration.observacion);
  assert.deepEqual(await counts(),{...before,validadores:before.validadores+1,flujo_eventos:before.flujo_eventos+1},'alta no crea casos, OS, stock ni eventos físicos');
  const initial=expect(await call('logistica','GET','/api/activos?tipo_equipo=VALIDADOR&q=7499001'),200,'maestro consultable');
  assert.equal(initial[0].estado_actual,'REGISTRADO');assert.equal(initial[0].bus_ppu,null);
  expect(await call('logistica','POST','/api/activos',registration),409,'duplicado no altera maestro');
  expect(await call('logistica','POST','/api/requerimientos',body),409,'registrado no equivale a instalado');
  assert.equal((await stock()).listos.some(o=>o.serie==='7499001'),false);
  const beforePhysical=await counts();
  await assert.rejects(pool.query(`INSERT INTO pmp.flujo_eventos(tipo,usuario_id,rol) VALUES('SIN_IDENTIDAD',$1,'logistica')`,[users.logistica.id]),e=>e.code==='23514');
  await assert.rejects(pool.query(`INSERT INTO pmp.escaneos_equipos(codigo_leido,tipo_codigo,estacion,tipo_equipo,serie,ubicacion_id,usuario_id,rol,resultado)
    VALUES('7499001','SERIE','BODEGA','VALIDADOR','7499001',1,$1,'logistica','VALIDADO')`,[users.logistica.id]),e=>e.code==='23514');
  const busesBefore=(await pool.query('SELECT * FROM pmp.buses ORDER BY ppu')).rows;
  const receptionBody={tipo_equipo:'VALIDADOR',serie:'7499001',validacion_inicial_conforme:true};
  expect(await call('logistica','POST','/api/activos/recepcion',receptionBody),409,'requires physical scan');
  const manual=expect(await call('logistica','POST','/api/activos/recepcion/validar',{...receptionBody,codigo:'7499001',origen_captura:'MANUAL'}),200,'manual consult');
  assert.equal(manual.escaneo,null);assert.equal(manual.elegible,false);
  expect(await call('admin','POST','/api/activos/recepcion/validar',{...receptionBody,codigo:'7499001',origen_captura:'SCANNER'}),403,'station permissions unchanged');
  expect(await call('logistica','POST','/api/activos/recepcion/validar',{...receptionBody,codigo:'7400010',origen_captura:'SCANNER'}),409,'wrong physical identity');
  const scanned=expect(await call('logistica','POST','/api/activos/recepcion/validar',{...receptionBody,codigo:'7499001',origen_captura:'SCANNER'}),200,'scan without OS');
  assert.equal(scanned.orden,null);
  assert.equal(await count('ordenes_servicio'),beforePhysical.ordenes_servicio,'scan never creates OS');
  assert.equal((await stock()).listos.some(o=>o.serie==='7499001'),false,'scan alone is not stock');
  const confirmedBody={...receptionBody,escaneo_id:scanned.escaneo.id};
  expect(await call('logistica','POST','/api/activos/recepcion',{...confirmedBody,validacion_inicial_conforme:false}),422,'initial conformity required');
  await pool.query(`CREATE FUNCTION pmp.e2e_fail_initial() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.tipo='HABILITADO_INSTALACION' THEN RAISE EXCEPTION 'forced availability failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER e2e_fail_initial BEFORE INSERT ON pmp.flujo_eventos FOR EACH ROW EXECUTE FUNCTION pmp.e2e_fail_initial()`);
  const beforeFailure=await counts();
  expect(await call('logistica','POST','/api/activos/recepcion',confirmedBody),500,'atomic physical reception');
  assert.deepEqual(await counts(),beforeFailure);
  await pool.query('DROP TRIGGER e2e_fail_initial ON pmp.flujo_eventos; DROP FUNCTION pmp.e2e_fail_initial()');
  const results=await Promise.all([0,1].map(()=>call('logistica','POST','/api/activos/recepcion',confirmedBody)));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409],'one physical reception under concurrency');
  const received=results.find(r=>r.status===201).data;
  assert.equal(received.estado_actual,'DISPONIBLE_INSTALACION');
  const newStock=(await stock()).listos.find(o=>o.serie==='7499001');
  assert.ok(newStock);assert.equal(newStock.codigo_os,null);assert.equal(newStock.bus_ppu,null);
  assert.equal(newStock.es_aprobado_qa,null);assert.equal(newStock.validacion_inicial_conforme,true);
  const initialKpi=expect(await call('logistica','GET','/api/bodega/dashboard'),200,'stock inicial en dashboard');
  assert.ok(initialKpi.distribucionEstados.some(r=>r.name==='DISPONIBLE_INSTALACION'&&r.estado_id===null&&r.value===1));
  assert.equal(await count('ordenes_servicio'),beforePhysical.ordenes_servicio,'reception never creates MV/MC/PDV/PDC/IN');
  assert.deepEqual((await pool.query('SELECT * FROM pmp.buses ORDER BY ppu')).rows,busesBefore,'no fictional bus created or used');
  const preHistory=await history('7499001');assert.equal(preHistory.ordenes.length,0);
  for(const event of ['ALTA_ACTIVO','ESCANEO_BODEGA','RECEPCION_INICIAL','HABILITADO_INSTALACION'])
    assert.ok(preHistory.eventos.some(e=>e.tipo===event&&e.codigo_os===null));
  const dashboard=()=>call('admin','GET','/api/dashboard/summary');
  const beforeDispatch=expect(await dashboard(),200,'initial stock KPI');
  expect(await call('logistica','POST','/api/requerimientos',body),409,'stock is not installed');
  const dispatchScan=expect(await call('logistica','POST','/api/bodega/despacho/validar',{...ctx,codigo:'7499001',origen_captura:'SCANNER'}),200,'fresh dispatch scan without placeholder OS');
  const first=expect(await call('logistica','POST','/api/bodega/despacho/confirmar',{...ctx,escaneo_id:dispatchScan.escaneo.id,
    tecnico_terreno_id:users.terreno.id,bus_ppu:bus,terminal_id:fixture.terminalId,pst_codigo:pst}),201,'first real OS is installation');
  assert.match(first.os.codigo_os,/^IN-\d{6,}$/);assert.equal(first.os.stock_origen_os,null);
  assert.equal(first.os.stock_origen_evento,received.stock_origen_evento);
  await assert.rejects(pool.query('UPDATE pmp.ordenes_servicio SET stock_origen_evento=NULL WHERE codigo_os=$1',[first.os.codigo_os]),e=>e.code==='23514');
  assert.equal((await history('7499001')).ordenes.length,1);
  assert.equal((await stock()).listos.some(o=>o.serie==='7499001'),false);
  assert.equal(expect(await dashboard(),200,'outbound KPI').kpis.totalEnRuta,beforeDispatch.kpis.totalEnRuta+1);
  expect(await call('terreno','POST','/api/os/completar-instalacion',{codigo_os:first.os.codigo_os,operativo:true,bus_ppu:bus}),200,'install initially received asset');
  const firstFailure=await create('AR-87126354','VALIDADOR','7499001');assert.equal(firstFailure.os.codigo_os,'MV-87126354');
  const firstLife=await history('7499001');assert.equal(firstLife.ordenes.length,2);
  assert.ok(firstLife.eventos.some(e=>e.tipo==='ALTA_ACTIVO'));
  report.initialReception={serie:'7499001',osBeforeDispatch:0,busPpu:null,stockOriginEvent:received.stock_origen_evento,
    firstOs:first.os.codigo_os,firstFault:firstFailure.os.codigo_os,initialEvents:preHistory.eventos.map(e=>e.tipo)};
  // An installed replacement belongs to its own complete lifetime history.
  const priorMaster=(await pool.query("SELECT * FROM pmp.validadores WHERE serie='7400010'")).rows[0];
  const seriesMatch=expect(await call('logistica','GET','/api/activos?tipo_equipo=VALIDADOR&q=7400010'),200,'buscar serie instalada');
  assert.equal(seriesMatch[0].bus_ppu,bus);assert.equal(seriesMatch[0].estado_actual,'EN_OPERACION');
  expect(await call('logistica','POST','/api/requerimientos',{...body,serie:'7400010',bus_ppu:'OTROBUS'}),409,'relación bus obligatoria');
  const later=await create('AR-00990003','VALIDADOR','7400010');
  assert.deepEqual((await pool.query("SELECT * FROM pmp.validadores WHERE serie='7400010'")).rows[0],priorMaster,'requerimiento no modifica maestro');
  const life=await history('7400010');
  assert.ok(life.ordenes.some(o=>o.codigo_os===sent.os.codigo_os));assert.ok(life.ordenes.some(o=>o.codigo_os===later.os.codigo_os));
  const oldCase=expect(await call('logistica','GET',`/api/requerimientos/${ctx.caso_id}`),200,'caso conserva alcance');
  assert.equal(oldCase.ordenes.some(o=>o.codigo_os===later.os.codigo_os),false);
  const console=expect(await call('admin','POST','/api/activos',{...registration,tipo_equipo:'CONSOLA'}),201,'Admin registra identidad de otro tipo');
  assert.equal(console.tipo_equipo,'CONSOLA');assert.equal(console.serie,'7499001');
  assert.equal((await history('7499001')).ordenes.length,2,'misma serie por tipo no fusiona historia');
  report.steps.push({action:'Maestro separado, sugerencia por bus/tipo, selección existente, desconocidos sin mutaciones y permisos',ok:true});
  report.steps.push({action:'Alta y recepción inicial sin OS, concurrencia, rollback, primera IN y primera falla real',ok:true});
  await runManualInitialReception({pool,call,stock,count,expect,ctx,report});
}
