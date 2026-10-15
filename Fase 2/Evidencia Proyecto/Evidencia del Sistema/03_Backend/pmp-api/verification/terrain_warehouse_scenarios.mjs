import assert from 'node:assert/strict';
import { listPendingWithdrawals } from '../src/services/terrainWithdrawalRead.js';
import { addFlowEvent } from '../src/services/bridgeFlow.js';

export async function runTerrainWarehouseScenarios({pool,call,stock,count,expect,fixture,users,pst,report}) {
  const serie='7490010',bus='BJ3070';
  await pool.query("INSERT INTO pmp.buses(ppu) VALUES($1) ON CONFLICT DO NOTHING",[bus]);
  await pool.query("INSERT INTO pmp.validadores(serie,modelo) VALUES($1,'CVB45')",[serie]);
  await pool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo)
    VALUES('VALIDADOR',$1,'Parque instalado',12,$2,$3,$4)`,[serie,bus,fixture.terminalId,pst]);
  const created=expect(await call('logistica','POST','/api/requerimientos',{
    origen:'ARANDA',referencia_externa:'AR-87126355',tipo_equipo:'VALIDADOR',serie,bus_ppu:bus,
    terminal_id:fixture.terminalId,pst_codigo:pst,falla:'QR',fecha_requerimiento:new Date().toISOString()
  }),201,'MV pendiente de retiro');
  const codigo_os=created.os.codigo_os;
  assert.equal(codigo_os,'MV-87126355');assert.equal(created.os.estado_id,1);
  const pendingWithdrawals=async(actor='logistica')=>expect(await call(actor,'GET','/api/os/pendientes-retiro'),200,'listado de retiros');
  const pending=(await pendingWithdrawals()).find(o=>o.codigo_os===codigo_os);
  assert.ok(pending);assert.equal(pending.tecnico_terreno_id,null);assert.equal(pending.estado_actual,'PENDIENTE_RETIRO');
  assert.equal(pending.serie,serie);assert.equal(pending.bus_ppu,bus);assert.equal(pending.tipo_equipo,'VALIDADOR');
  assert.equal(pending.falla,'QR');assert.equal(pending.referencia_ar,'AR-87126355');
  const terminal=(await pool.query('SELECT nombre FROM pmp.terminales WHERE id=$1',[fixture.terminalId])).rows[0].nombre;
  const operator=(await pool.query('SELECT nombre FROM pmp.pst WHERE codigo=$1',[pst])).rows[0].nombre;
  assert.equal(pending.terminal,terminal);assert.equal(pending.operador,operator);
  assert.equal(pending.modelo,'CVB45');
  // Exercise missing read-model fields in an isolated transaction; persist no changes.
  const readFixture=await pool.connect();
  try {
    await readFixture.query('BEGIN');
    const blankTerminal=(await readFixture.query("INSERT INTO pmp.terminales(nombre) VALUES('') RETURNING id")).rows[0].id;
    await readFixture.query("INSERT INTO pmp.pst(codigo,nombre) VALUES('E2E_EMPTY_CONTEXT','')");
    await readFixture.query("INSERT INTO pmp.terminal_pst(terminal_id,pst_codigo) VALUES($1,'E2E_EMPTY_CONTEXT')",[blankTerminal]);
    await readFixture.query("UPDATE pmp.ordenes_servicio SET terminal_id=$2,pst_codigo='E2E_EMPTY_CONTEXT',falla=' ' WHERE codigo_os=$1",[codigo_os,blankTerminal]);
    const resolved=async(code=codigo_os)=>(await listPendingWithdrawals(readFixture)).find(o=>o.codigo_os===code);
    let row=await resolved();assert.equal(row.terminal,terminal);assert.equal(row.operador,operator);assert.equal(row.falla,'QR');
    const blankCase=(await readFixture.query(`INSERT INTO pmp.casos_operacionales
      (codigo_caso,origen,componente,tipo_equipo,serie_origen,bus_ppu,terminal_id,pst_codigo,falla_reportada,fecha_requerimiento,creado_por)
      SELECT 'INT-E2E-READ','INTERNO','INT-E2E-READ',tipo_equipo,serie_origen,bus_ppu,$2,'E2E_EMPTY_CONTEXT',falla_reportada,fecha_requerimiento,creado_por
      FROM pmp.casos_operacionales WHERE id=$1 RETURNING id`,[created.caso.id,blankTerminal])).rows[0].id;
    const fixtureOrder=async(caseId)=>{
      const order=(await readFixture.query(`INSERT INTO pmp.ordenes_servicio
        (tipo_equipo,validador_serie,consola_serie,bus_ppu,terminal_id,pst_codigo,falla,estado_id,caso_id)
        SELECT tipo_equipo,validador_serie,consola_serie,bus_ppu,terminal_id,pst_codigo,' ',1,$2
        FROM pmp.ordenes_servicio WHERE codigo_os=$1 RETURNING codigo_os`,[codigo_os,caseId])).rows[0];
      await addFlowEvent(readFixture,{os:order.codigo_os,type:'REQUERIMIENTO_INGRESADO',user:{id:users.logistica.id,rol:'logistica'},metadata:{caso_id:created.caso.id}});
      return order.codigo_os;
    };
    row=await resolved(await fixtureOrder(blankCase));assert.equal(row.terminal,terminal);assert.equal(row.operador,operator,'resuelve instalación del mismo tipo+serie+bus');
    row=await resolved(await fixtureOrder(null));assert.equal(row.falla,'QR');assert.equal(row.referencia_ar,'AR-87126355','recupera relación del requerimiento');
    assert.equal(row.estado_actual,'PENDIENTE_RETIRO');assert.equal(row.modelo,'CVB45');
  } finally {await readFixture.query('ROLLBACK');readFixture.release();}
  assert.ok((await pendingWithdrawals('admin')).some(o=>o.codigo_os===codigo_os));
  for(const actor of ['terreno','lab','qa'])expect(await call(actor,'GET','/api/os/pendientes-retiro'),403,'listado solo admin/logistica');
  const queue=async()=>expect(await call('logistica','GET','/api/bodega/queue'),200,'cola');
  const kpis=async()=>expect(await call('admin','GET','/api/dashboard/summary'),200,'KPI').kpis;
  const beforeKpi=await kpis();
  const noQueue=async()=>assert.ok(!(await queue()).some(o=>o.codigo_os===codigo_os));
  await noQueue();
  const associated=expect(await call('logistica','GET',`/api/activos?tipo_equipo=VALIDADOR&bus_ppu=${bus}`),200,'bus conserva activo');
  assert.ok(associated.some(a=>a.serie===serie&&a.bus_ppu===bus));
  // Previously created requirements without physical evidence are also pending.
  await pool.query('UPDATE pmp.ordenes_servicio SET estado_id=2 WHERE codigo_os=$1',[codigo_os]);
  await noQueue();
  assert.equal((await kpis()).totalEnTransito,beforeKpi.totalEnTransito,'requerimiento anterior no equivale a tránsito físico');
  const pendingHistory=expect(await call('logistica','GET',`/api/bridge/activos/VALIDADOR/${serie}/historial`),200,'estado coherente en historial');
  assert.equal(pendingHistory.ordenes.find(o=>o.codigo_os===codigo_os).estado,'PENDIENTE_RETIRO');
  expect(await call('logistica','PUT','/api/bodega/receive',{codigo_os}),409,'no recepción anticipada');
  expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',{codigo_os,codigo:serie,tipo_equipo:'VALIDADOR',origen_captura:'SCANNER'}),409,'no captura anticipada');
  expect(await call('logistica','POST','/api/equipment-scan/confirm',{codigo:serie,estacion:'BODEGA'}),409,'lector genérico tampoco omite retiro');
  expect(await call('logistica','POST','/api/os/asignar-retiro',{codigo_os,tecnico_terreno_id:users.terreno.id}),200,'asignación no mueve activo');
  const assigned=(await pendingWithdrawals()).find(o=>o.codigo_os===codigo_os);
  assert.equal(assigned.tecnico_terreno_id,users.terreno.id);assert.ok(assigned.tecnico);
  assert.equal(assigned.estado_actual,'PENDIENTE_RETIRO');assert.equal(assigned.bus_ppu,bus);
  await noQueue();assert.equal((await kpis()).totalEnRuta,beforeKpi.totalEnRuta);
  // Pending work must remain visible even outside the twenty most recent orders.
  await pool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo,tecnico_terreno_id)
    SELECT 'VALIDADOR',$1,'Historia aislada para paginación',13,$2,$3,$4,$5 FROM generate_series(1,21)`,[serie,bus,fixture.terminalId,pst,users.terreno.id]);
  const own=expect(await call('terreno','GET','/api/os/mis-ordenes'),200,'tarea terreno').find(o=>o.codigo_os===codigo_os);
  assert.equal(own.estado_nombre,'PENDIENTE_RETIRO');
  const identified=expect(await call('terreno','POST','/api/os/validar-identidad-retiro',{codigo_os,codigo_leido:serie,metodo_validacion:'MANUAL',motivo_manual:'QR_ILEGIBLE',observacion_manual:'Etiqueta dañada; serie comprobada físicamente'}),200,'identidad por contingencia manual');
  const withdrawal={validacion_id:identified.validacion_id,pod:false,codigo_os,tipo_equipo:'VALIDADOR',serie,bus_ppu:bus,retiro_confirmado:true,evidencia:'Retiro físico confirmado desde BJ3070'};
  for(const change of [{serie:'7490011'},{tipo_equipo:'CONSOLA'},{bus_ppu:'OTRO'},{retiro_confirmado:false},{evidencia:123}])
    expect(await call('terreno','POST','/api/os/confirmar-retiro',{...withdrawal,...change}),422,'retiro incorrecto bloqueado');
  expect(await call('admin','POST','/api/os/confirmar-retiro',withdrawal),403,'solo técnico asignado');
  const removed=expect(await call('terreno','POST','/api/os/confirmar-retiro',withdrawal),200,'retiro confirmado');
  assert.equal((removed.os||removed).estado_id,2);
  const withdrawalAudit=(await pool.query("SELECT metadata FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='RETIRO_TERRENO_CONFIRMADO'",[codigo_os])).rows[0].metadata;
  assert.equal(withdrawalAudit.metodo_validacion,'MANUAL');assert.equal(withdrawalAudit.motivo_manual,'QR_ILEGIBLE');assert.equal(withdrawalAudit.fotografias.length,0);
  assert.ok(!(await pendingWithdrawals()).some(o=>o.codigo_os===codigo_os),'confirmación física retira la OS del listado de pendientes');
  assert.ok((await queue()).some(o=>o.codigo_os===codigo_os));
  assert.equal((await kpis()).totalEnTransito,beforeKpi.totalEnTransito+1,'retiro real incrementa tránsito');
  expect(await call('terreno','POST','/api/os/confirmar-retiro',withdrawal),409,'retiro no duplicado');
  const capture={motivo:'Escáner de prueba no disponible',codigo_os,tipo_equipo:'VALIDADOR',codigo:serie,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true};
  const scansBefore=await count('escaneos_equipos');
  const eventsBefore=await count('flujo_eventos');
  const query=expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',{...capture,origen_captura:'MANUAL'}),200,'consulta sin movimiento');
  assert.equal(query.elegible,false);assert.equal(await count('flujo_eventos'),eventsBefore);
  for(const actor of ['terreno','lab','qa'])expect(await call(actor,'POST','/api/bodega/recepcion-terreno/validar',capture),403,'permiso manual');
  for(const change of [{motivo:''},{codigo:'7490010 '},{codigo:'7490011'},{tipo_equipo:'CONSOLA'},{presencia_fisica_confirmada:false}])
    expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',{...capture,...change}),422,'identidad o presencia incorrecta');
  const receipt=expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',capture),200,'captura manual recepción');
  assert.ok(receipt.validacion.id);assert.equal(receipt.escaneo,null);
  expect(await call('admin','PUT','/api/bodega/receive',{codigo_os,validacion_id:receipt.validacion.id}),409,'no usar evidencia de otro usuario');
  expect(await call('logistica','PUT','/api/bodega/receive',{codigo_os,validacion_id:receipt.validacion.id}),200,'recepción manual confirmada');
  assert.equal((await pool.query('SELECT estado_id FROM pmp.ordenes_servicio WHERE codigo_os=$1',[codigo_os])).rows[0].estado_id,3);
  assert.equal(await count('escaneos_equipos'),scansBefore,'manual nunca se registra como scanner');
  const audit=(await pool.query("SELECT * FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='RECEPCION_TERRENO_BODEGA'",[codigo_os])).rows[0];
  const manualProof=(await pool.query('SELECT metadata FROM pmp.flujo_eventos WHERE id=$1',[receipt.validacion.id])).rows[0].metadata;assert.equal(manualProof.motivo,capture.motivo);
  assert.equal(audit.metadata.origen_captura,'MANUAL_AUTORIZADO');assert.equal(audit.usuario_id,users.logistica.id);assert.ok(audit.fecha);

  const ctx={caso_id:created.caso.id,os_origen:codigo_os,tipo_equipo:'VALIDADOR'};
  const payload={...ctx,tecnico_terreno_id:users.terreno.id,bus_ppu:bus,terminal_id:fixture.terminalId,pst_codigo:pst};
  const initial=(await pool.query("SELECT id FROM pmp.flujo_eventos WHERE tipo_equipo='VALIDADOR' AND serie='7201234' AND tipo='VALIDACION_BODEGA' AND metadata->>'contexto'='RECEPCION_INICIAL' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.ok(initial);
  expect(await call('logistica','POST','/api/bodega/despacho/confirmar',{...payload,validacion_id:initial.id}),409,'recepción inicial no sustituye despacho');
  expect(await call('logistica','POST','/api/bodega/despacho/confirmar',{...payload,validacion_id:receipt.validacion.id}),409,'recepción terreno no sustituye despacho');
  const input={...ctx,codigo:'7201234',origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true};
  for(const change of [{codigo:'7201234 '},{presencia_fisica_confirmada:false}])expect(await call('admin','POST','/api/bodega/despacho/validar',{...input,...change}),422,'manual despacho incorrecto');
  const ordersBefore=await count('ordenes_servicio'),beforeDispatch=await kpis();
  const ready=expect(await call('admin','POST','/api/bodega/despacho/validar',input),200,'admin captura despacho manual');
  assert.equal(await count('ordenes_servicio'),ordersBefore);assert.equal((await kpis()).totalEnRuta,beforeDispatch.totalEnRuta);
  assert.ok((await stock()).listos.some(a=>a.serie==='7201234'&&a.tipo_equipo==='VALIDADOR'));
  const sent=expect(await call('admin','POST','/api/bodega/despacho/confirmar',{...payload,validacion_id:ready.validacion.id}),201,'despacho manual confirmado');
  assert.match(sent.os.codigo_os,/^IN-\d{6,}$/);assert.notEqual(sent.os.codigo_os,'IN-87126355');
  assert.equal(sent.os.estado_id,1);assert.equal(sent.os.tecnico_terreno_id,users.terreno.id);
  assert.equal(await count('ordenes_servicio'),ordersBefore+1);assert.equal((await kpis()).totalEnRuta,beforeDispatch.totalEnRuta+1);
  assert.ok(!(await stock()).listos.some(a=>a.serie==='7201234'&&a.tipo_equipo==='VALIDADOR'));
  assert.ok((await stock()).listos.some(a=>a.serie==='7201234'&&a.tipo_equipo==='CONSOLA'),'identidad incluye tipo');
  assert.equal(await count('escaneos_equipos'),scansBefore);
  expect(await call('admin','POST','/api/bodega/despacho/confirmar',{...payload,validacion_id:ready.validacion.id}),201,'reintento devuelve el despacho ya confirmado');
  const history=expect(await call('admin','GET','/api/bridge/activos/VALIDADOR/7201234/historial'),200,'historial de salida');
  const exit=history.eventos.find(e=>e.tipo==='SALIDA_BODEGA_TERRENO');
  assert.equal(exit.detalle.metadata.origen_captura,'MANUAL_AUTORIZADO');assert.ok(exit.detalle.metadata.validacion_id);assert.equal(exit.detalle.metadata.escaneo_id,undefined);
  report.steps.push({action:'Terreno pendiente conserva bus; retiro físico habilita Bodega; recepción y despacho manual autorizados, auditados y separados, IN al confirmar y KPI En ruta',ok:true});
}
