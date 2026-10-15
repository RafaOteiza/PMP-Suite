import assert from 'node:assert/strict';

// Runs only inside requirements_flow_e2e's disposable PostgreSQL cluster.
export async function runManualInitialReception({pool,call,stock,count,expect,ctx,report}) {
  const totals=async()=>Object.fromEntries(await Promise.all(['validadores','consolas','ordenes_servicio','casos_operacionales','bridge_referencias','flujo_eventos','escaneos_equipos','buses'].map(async table=>[table,await count(table)])));
  const dashboard=async()=>expect(await call('admin','GET','/api/dashboard/summary'),200,'dashboard manual reception');
  for(const [actor,tipo_equipo] of [['logistica','VALIDADOR'],['admin','CONSOLA']]){
    const asset={tipo_equipo,serie:'7201234'};
    const registration={...asset,origen:'Compra E2E manual',fecha_ingreso:new Date().toISOString()};
    const before=await totals();
    const registered=expect(await call(actor,'POST','/api/activos',registration),201,'manual reception fixture');
    assert.equal(registered.estado_actual,'REGISTRADO');
    assert.equal((await stock()).listos.some(x=>x.serie===asset.serie&&x.tipo_equipo===tipo_equipo),false);
    const lookup=()=>call(actor,'GET',`/api/activos?tipo_equipo=${tipo_equipo}&q=7201234`);
    assert.equal(expect(await lookup(),200,'registered remains outside stock')[0].estado_actual,'REGISTRADO');
    const payload={...asset,codigo:'7201234',origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true};
    const beforeCapture=await totals();
    for(const codigo of ['7201235','7201234 ',' 7201234','205000012341'])
      expect(await call(actor,'POST','/api/activos/recepcion/validar',{...payload,codigo}),422,'manual exact series');
    expect(await call(actor,'POST','/api/activos/recepcion/validar',{...payload,presencia_fisica_confirmada:false}),422,'explicit presence');
    for(const other of ['terreno','lab','qa']){
      expect(await call(other,'POST','/api/activos/recepcion/validar',payload),403,'manual forbidden role');
      expect(await call(other,'POST','/api/activos/recepcion',{...asset,validacion_id:1,validacion_inicial_conforme:true}),403,'manual confirmation forbidden role');
    }
    const consult=expect(await call(actor,'POST','/api/activos/recepcion/validar',{...payload,origen_captura:'MANUAL'}),200,'plain manual consultation');
    assert.equal(consult.elegible,false);assert.equal(consult.escaneo,null);
    assert.deepEqual(await totals(),beforeCapture,'rejected manual capture and queries create no events');
    const scanned=expect(await call(actor,'POST','/api/activos/recepcion/validar',payload),200,'manual authorized evidence');
    assert.equal(scanned.escaneo,null);assert.equal(scanned.origen_captura,'MANUAL_AUTORIZADO');assert.equal(scanned.elegible,true);
    assert.equal(expect(await lookup(),200,'capture alone not reception')[0].estado_actual,'REGISTRADO');
    assert.equal((await stock()).listos.some(x=>x.serie===asset.serie&&x.tipo_equipo===tipo_equipo),false);
    const confirm={...asset,validacion_id:scanned.validacion.id,validacion_inicial_conforme:true};
    expect(await call(actor==='admin'?'logistica':'admin','POST','/api/activos/recepcion',confirm),409,'evidence belongs to capturing actor');
    expect(await call(actor,'POST','/api/activos/recepcion',{...confirm,escaneo_id:1}),422,'ambiguous evidence');
    expect(await call(actor,'POST','/api/activos/recepcion',{...confirm,validacion_inicial_conforme:false}),422,'separate initial conformity');
    const fresh=expect(await call(actor,'POST','/api/activos/recepcion/validar',payload),200,'fresh manual evidence');
    expect(await call(actor,'POST','/api/activos/recepcion',confirm),409,'stale manual evidence');
    confirm.validacion_id=fresh.validacion.id;
    const stockBefore=await stock(),kpiBefore=await dashboard();
    const accepted=expect(await call(actor,'POST','/api/activos/recepcion',confirm),201,'manual initial reception');
    assert.equal(accepted.estado_actual,'DISPONIBLE_INSTALACION');
    const stockAfter=await stock(),kpiAfter=await dashboard();
    assert.equal(stockAfter.listos.length,stockBefore.listos.length+1);
    assert.deepEqual(stockAfter.inventario,stockBefore.inventario,'reception does not duplicate master inventory');
    assert.equal(kpiAfter.kpis.totalReparados,kpiBefore.kpis.totalReparados+1);
    assert.equal(kpiAfter.kpis.totalEnRuta,kpiBefore.kpis.totalEnRuta);
    assert.equal(kpiAfter.kpis.totalOperativos,kpiBefore.kpis.totalOperativos);
    const ready=stockAfter.listos.find(x=>x.serie===asset.serie&&x.tipo_equipo===tipo_equipo);
    assert.equal(ready.codigo_os,null);assert.equal(ready.bus_ppu,null);assert.equal(ready.ubicacion,'E2E_SCAN_FLOW BODEGA');
    assert.equal(ready.escaneado_bodega,false,'manual evidence is never advertised as scanner');
    assert.ok(ready.elegible);assert.ok(ready.validacion_inicial_conforme);
    const after=await totals();
    for(const table of ['ordenes_servicio','casos_operacionales','bridge_referencias','escaneos_equipos','buses'])assert.equal(after[table],before[table],table);
    const history=expect(await call(actor,'GET',`/api/bridge/activos/${tipo_equipo}/7201234/historial`),200,'manual audit history');
    assert.equal(history.ordenes.length,0);
    for(const tipo of ['VALIDACION_BODEGA','RECEPCION_INICIAL','HABILITADO_INSTALACION']){
      const event=history.eventos.find(x=>x.tipo===tipo);assert.ok(event,tipo);
      assert.equal(event.codigo_os,null);assert.match(event.comentario,/MANUAL_AUTORIZADO/);
      assert.equal(event.detalle.metadata.origen_captura,'MANUAL_AUTORIZADO');
    }
    expect(await call(actor,'POST','/api/activos/recepcion',confirm),409,'no duplicate reception');
    assert.deepEqual(await totals(),after,'duplicate is atomic');
    const state=expect(await lookup(),200,'received lookup')[0];assert.equal(state.estado_actual,'DISPONIBLE_INSTALACION');assert.equal(state.bus_ppu,null);
    if(tipo_equipo==='VALIDADOR')expect(await call('logistica','POST','/api/bodega/despacho/validar',{...ctx,codigo:'7201234',origen_captura:'MANUAL_AUTORIZADO'}),422,'manual reception does not authorize manual dispatch');
  }
  report.steps.push({action:'Recepción manual autorizada admin/logistica por tipo+serie: stock +1, sin OS, sin duplicar inventario, origen auditable y permisos/escáner intactos',ok:true});
}
