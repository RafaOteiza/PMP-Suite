// All writes target the disposable cluster; the habitual DB supplies schema/catalog reads only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {emptyFixtureDatabase} from '../tools/ephemeral-postgres.mjs';
import {pool,root} from '../tools/database-tools.mjs';
import {readOperationalInsights} from '../src/services/operationalInsights.js';
import {readExecutiveDashboard} from '../src/services/executiveDashboard.js';
import {searchRegisteredAssets} from '../src/services/assetManagement.js';
import {createCaseWithClient,listCases} from '../src/services/requirements.js';
import {addFlowEvent} from '../src/services/bridgeFlow.js';
let fixture,db;const report={checks:[],passed:false};
try{
 fixture=await emptyFixtureDatabase();assert.notEqual(fixture.port,5432);db=pool(fixture.url);
 let data=await readOperationalInsights(db);assert.equal(data.summary.orders,0);assert.deepEqual(data.buses,[]);assert.deepEqual(data.components,[]);
 report.checks.push('Vacío real: ceros y listas vacías');
 await db.query("INSERT INTO pmp.validadores(serie,modelo,marca) VALUES('AI-FIXTURE','CVB45','Fixture')");
 await db.query("INSERT INTO pmp.consolas(serie,modelo,marca) VALUES('AI-FIXTURE','N9715','Fixture')");
 const make=async(type,installation,days,fault)=> (await db.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,consola_serie,falla,estado_id,ubicacion_id,bus_ppu,terminal_id,pst_codigo,fecha,es_instalacion)
 VALUES($1,$2,$3,$4,3,1,'BJ2149',1,'U15',now()-($5::int*interval '1 day'),$6) RETURNING codigo_os`,[type,type==='VALIDADOR'?'AI-FIXTURE':null,type==='CONSOLA'?'AI-FIXTURE':null,fault,days,installation])).rows[0].codigo_os;
 await make('VALIDADOR',true,20,'Instalación');const first=await make('VALIDADOR',false,10,'Falla QR');const second=await make('VALIDADOR',false,1,'Falla QR');await make('CONSOLA',false,2,'[SIMULACION] Audio intermitente');
 const user=(await db.query("SELECT * FROM pmp.usuarios WHERE rol='tecnico_laboratorio'")).rows[0];
 const event=(os,type,metadata)=>addFlowEvent(db,{os,type,user,metadata,asset:{tipo_equipo:'VALIDADOR',serie:'AI-FIXTURE'}});
 await event(first,'LAB_REPARACION_FINALIZADA',{ciclo:'1',trabajo:{resultado:'REPARADO',diagnostico:{falla_real:'Lector QR'}}});
 await event(first,'LAB_REPARACION_FINALIZADA',{ciclo:'1',trabajo:{resultado:'REPARADO',diagnostico:{falla_real:'Lector QR'}}});
 await event(first,'LAB_REPARACION_FINALIZADA',{ciclo:'2',trabajo:{resultado:'NFF',diagnostico:{resultado:'NFF'}}});
 await event(second,'LAB_REPARACION_FINALIZADA',{ciclo:'1',trabajo:{resultado:'POD',diagnostico:{falla_real:'Carcasa dañada'}}});
 await event(first,'LOGISTICA_ENTREGA_REPUESTO',{solicitud_id:'fixture1',repuesto_id:1,nombre:'Lector QR',cantidad:2});
 await event(first,'LOGISTICA_ENTREGA_REPUESTO',{solicitud_id:'fixture1',repuesto_id:1,nombre:'Lector QR',cantidad:2});
 await event(second,'LOGISTICA_ENTREGA_REPUESTO',{solicitud_id:'fixture2',repuesto_id:1,nombre:'Lector QR',cantidad:1});
 data=await readOperationalInsights(db);assert.equal(data.summary.orders,3);assert.equal(data.summary.assets,2);assert.equal(data.summary.simulationOrders,1);
 assert.deepEqual(data.buses,[{ppu:'BJ2149',validadores:2,consolas:1,total:3,activos:2}]);assert.equal(data.faults.find(f=>f.falla==='Falla QR').total,2);
 assert.equal(data.components[0].ordenes,2);assert.equal(data.components[0].unidades,3);assert.equal(data.diagnoses.find(d=>d.falla==='Lector QR').total,1);
 assert.equal(data.analysis.assets.length,2);assert.equal(data.analysis.assets.find(a=>a.tipo==='VALIDADOR').medianDays,9);
 assert.equal(data.analysis.assets.find(a=>a.tipo==='CONSOLA').estimate,null);
 assert.equal(data.analysis.outcomes.reduce((n,r)=>n+r.total,0),2);
 assert.ok(data.analysis.parts.every(p=>p.leadTimeDays===null));
 assert.equal(data._evidence,undefined);
 report.checks.push('Recurrencia, intervalos, último cierre por activo y stock analizados sin exponer evidencia cruda');
 report.checks.push('IN excluidas; tipo+serie separados; ambos tipos por bus; simulación identificada; entregas y diagnósticos sin duplicados');
 const insights=(await readExecutiveDashboard(db)).labInsights;
 assert.equal(insights.finished30Days,3);assert.equal(insights.closuresByWeek.reduce((n,r)=>n+r.total,0),3);assert.equal(insights.closureResults.reduce((n,r)=>n+r.total,0),3);
 assert.deepEqual(insights.closureResults.map(r=>r.resultado).sort(),['NFF','POD','REPARADO']);
 report.checks.push('Cierres por OS/ciclo: duplicado excluido, reingreso contado, NFF sin reparación inventada');
 await db.query("INSERT INTO pmp.validadores(serie,modelo,marca) SELECT 'EXPORT-'||lpad(n::text,3,'0'),'CVB45','Fixture' FROM generate_series(1,105) n");
 const master1=await searchRegisteredAssets(db,{tipo_equipo:'VALIDADOR',q:'EXPORT-',limit:100,offset:0});
 const master2=await searchRegisteredAssets(db,{tipo_equipo:'VALIDADOR',q:'EXPORT-',limit:100,offset:100});
 assert.equal(master1.length,100);assert.equal(master2.length,5);assert.equal(new Set([...master1,...master2].map(a=>a.serie)).size,105);
 for(let i=1;i<=105;i++)await createCaseWithClient(db,{origen:'INTERNO',tipo:'VALIDADOR',serie:'EXPORT-'+String(i).padStart(3,'0'),bus:'BJ2149',terminal:1,pst:'U15',falla:'Export fixture',fecha:'2026-10-12',observacion:null},user);
 const cases1=await listCases(db,'EXPORT-',{limit:100,offset:0}),cases2=await listCases(db,'EXPORT-',{limit:100,offset:100});
 assert.equal(cases1.length,100);assert.equal(cases2.length,5);assert.equal(new Set([...cases1,...cases2].map(c=>c.id)).size,105);
 report.checks.push('Exportaci?n: 105 activos y 105 casos filtrados recuperados por paginaci?n sin duplicados');
 // Test the real Python reader against ONLY the isolated URL.
 const output=execFileSync(resolve(root,'06_ModelosIA/.venv/Scripts/python.exe'),[resolve(root,'06_ModelosIA/src/analyzer.py'),'--json'],{env:{...process.env,DATABASE_URL:fixture.url},windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const risks=JSON.parse(output);assert.equal(risks.length,2);assert.equal(risks.find(r=>r.tipo_equipo==='VALIDADOR').fallas_previas,1);assert.equal(risks.find(r=>r.tipo_equipo==='CONSOLA').fallas_previas,0);
 report.checks.push('Python real: IN no aumenta recurrencia, tipos aislados, una fila por activo');
 report.passed=true;
}catch(error){report.error=error.message;process.exitCode=1;}finally{
 if(db)await db.end();if(fixture){await fixture.dispose();report.ephemeralRemoved=true;}
 const out=resolve(root,'.local/test-results/operational-insights');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'e2e.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
