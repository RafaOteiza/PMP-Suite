import assert from 'node:assert/strict';

export async function runRequirementSearchScenarios({pool,call,expect,fixture,users,pst,report}) {
  const buses=['OPBUS01','OPBUS02','LABBUS01'];
  for(const bus of buses)await pool.query('INSERT INTO pmp.buses(ppu) VALUES($1)',[bus]);
  const seed=async(serie,type,bus,state=12,location=null)=>{
    await pool.query(`INSERT INTO pmp.${type==='VALIDADOR'?'validadores':'consolas'}(serie,modelo,marca) VALUES($1,'Modelo operativo','Marca E2E')`,[serie]);
    return (await pool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,consola_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo,ubicacion_id)
      VALUES($1,$2,$3,'Instalación vigente E2E',$4,$5,$6,$7,$8) RETURNING *`,[type,type==='VALIDADOR'?serie:null,type==='CONSOLA'?serie:null,state,bus,fixture.terminalId,pst,location])).rows[0];
  };
  await seed('74900OP1','VALIDADOR',buses[0]);await seed('74900OP2','VALIDADOR',buses[0]);
  await seed('74900OP1','CONSOLA',buses[0]);await seed('74900OP3','CONSOLA',buses[1]);
  for(const [serie,state,location] of [['74900BOD',3,1],['74900QA',6,3],['74900DIAG',4,2],['74900PEND',7,1]])await seed(serie,'VALIDADOR',buses[2],state,location);
  const assets=async(query)=>expect(await call('logistica','GET',`/api/requerimientos/operativos?${new URLSearchParams(query)}`),200,'consulta operativa');
  const matches=expect(await call('logistica','GET','/api/requerimientos/buses?tipo_equipo=VALIDADOR&bus_ppu=OPB'),200,'PPU parcial');
  assert.deepEqual(matches.items.map(b=>b.bus_ppu),[buses[0]]);
  assert.equal(expect(await call('logistica','GET','/api/requerimientos/buses?tipo_equipo=VALIDADOR&bus_ppu=LABBUS'),200,'bus sin activos operativos').items.length,0);
  const consoles=expect(await call('logistica','GET','/api/requerimientos/buses?tipo_equipo=CONSOLA&bus_ppu=OPB'),200,'PPU por tipo');
  assert.deepEqual(consoles.items.map(b=>b.bus_ppu),buses.slice(0,2));
  const byBus=await assets({tipo_equipo:'CONSOLA',bus_ppu:buses[1],bus_exacto:true});assert.equal(byBus.items.length,1);assert.equal(byBus.items[0].serie,'74900OP3');
  const bySeries=await assets({tipo_equipo:'VALIDADOR',q:'74900'});
  assert.deepEqual(bySeries.items.map(a=>a.serie),['74900OP1','74900OP2']);
  for(const row of bySeries.items){assert.equal(row.estado_actual,'EN_OPERACION');assert.equal(row.bus_ppu,buses[0]);assert.equal(row.terminal_id,fixture.terminalId);assert.equal(row.pst_codigo,pst);assert.ok(row.terminal);assert.ok(row.operador);}
  assert.equal((await assets({tipo_equipo:'VALIDADOR',q:'74900',limit:1})).has_more,true);
  assert.equal((await assets({tipo_equipo:'VALIDADOR',q:'74900',limit:1,offset:1})).items[0].serie,'74900OP2');
  assert.equal((await assets({tipo_equipo:'VALIDADOR',q:'74900',limit:1,offset:2})).items.length,0);
  assert.ok((await assets({tipo_equipo:'VALIDADOR'})).items.length<=20);
  assert.equal((await assets({tipo_equipo:'VALIDADOR',q:'%'})).items.length,0,'comodines tratados como texto');
  expect(await call('logistica','GET','/api/requerimientos/operativos?tipo_equipo=VALIDADOR&limit=5000'),422,'límite acotado');
  const input={origen:'ARANDA',referencia_externa:'AR-88990001',tipo_equipo:'VALIDADOR',serie:'74900OP1',bus_ppu:buses[0],terminal_id:fixture.terminalId,pst_codigo:pst,falla:'QR no responde',fecha_requerimiento:new Date().toISOString()};
  expect(await call('logistica','POST','/api/requerimientos',{...input,bus_ppu:buses[1]}),409,'bus incompatible');
  expect(await call('logistica','POST','/api/requerimientos',{...input,terminal_id:fixture.terminalId+100}),409,'terminal distinto a instalación');
  expect(await call('logistica','POST','/api/requerimientos',{...input,pst_codigo:'OTRO'}),409,'operador distinto a instalación');
  const first=expect(await call('logistica','POST','/api/requerimientos',input),201,'primera intervención');
  await pool.query('UPDATE pmp.ordenes_servicio SET tecnico_terreno_id=$2 WHERE codigo_os=$1',[first.os.codigo_os,users.terreno.id]);
  const active=async(type,serie)=>expect(await call('logistica','GET',`/api/requerimientos/intervenciones-activas?tipo_equipo=${type}&serie=${serie}`),200,'intervenciones activas');
  const orders=await active('VALIDADOR',input.serie);
  assert.equal(orders.length,1);assert.equal(orders[0].codigo_os,first.os.codigo_os);assert.equal(orders[0].referencia_ar,input.referencia_externa);
  assert.equal(orders[0].bus_ppu,buses[0]);assert.equal(orders[0].falla,input.falla);assert.equal(orders[0].estado_actual,'PENDIENTE_RETIRO');assert.ok(orders[0].tecnico);
  assert.ok((await assets({tipo_equipo:'VALIDADOR',q:input.serie})).items.length,'activo instalado con retiro pendiente sigue consultable para advertir duplicado');
  expect(await call('logistica','POST','/api/requerimientos',{...input,referencia_externa:'AR-88990002'}),409,'bloqueo por tipo y serie');
  expect(await call('logistica','POST','/api/requerimientos',{...input,serie:'74900OP2'}),409,'referencia AR incompatible');
  expect(await call('logistica','POST','/api/requerimientos',{...input,serie:'74900OP2',referencia_externa:'AR-88990003'}),201,'otro activo del mismo bus permitido');
  assert.equal((await active('CONSOLA',input.serie)).length,0,'serie compartida entre tipos no bloquea');
  expect(await call('logistica','POST','/api/requerimientos',{...input,tipo_equipo:'CONSOLA',referencia_externa:'AR-88990004'}),201,'misma serie de otro tipo permitido');
  await pool.query('UPDATE pmp.ordenes_servicio SET estado_id=13 WHERE codigo_os=$1',[first.os.codigo_os]);
  assert.equal((await active('VALIDADOR',input.serie)).length,0);
  const requests=await Promise.all([5,6].map(n=>call('logistica','POST','/api/requerimientos',{...input,referencia_externa:`AR-8899000${n}`})));
  assert.deepEqual(requests.map(r=>r.status).sort(),[201,409],'cierre permite futura intervención; concurrencia no duplica');
  report.steps.push({action:'Búsqueda operativa bidireccional, PPU parcial/tipo, exclusión de laboratorio y Bodega, contexto vigente, paginación, duplicados por activo y protección AR',ok:true});
}
