import test from 'node:test';
import assert from 'node:assert/strict';
import {permits} from '../src/security/authorization.js';
import {readOperationalInsights} from '../src/services/operationalInsights.js';
import {buildMaintenanceAnalysis} from '../src/services/maintenanceAnalysis.js';

test('recurrencia distingue identidad, intervalos y simulación sin inventar predicciones',()=>{
 const orders=[0,10,25,50].map((d,i)=>({codigo_os:'MV-'+i,tipo_equipo:'VALIDADOR',serie:'FIX',fecha:new Date(Date.UTC(2026,0,1+d)).toISOString(),falla:'Falla QR'}));
 orders.push({codigo_os:'MC-1',tipo_equipo:'CONSOLA',serie:'FIX',fecha:'2026-03-01',falla:'[SIMULACION] Falla'});
 const copy=structuredClone(orders),r=buildMaintenanceAnalysis({orders},'2026-04-01');
 assert.equal(r.assets.length,2);assert.equal(r.assets[0].failures,4);assert.equal(r.assets[0].medianDays,15);assert.equal(r.assets[0].estimate.intervals,3);assert.equal(r.assets[1].estimate,null);assert.deepEqual(orders,copy);
 assert.equal(r.outcomes[0].label,'SIN_CIERRE');assert.equal(r.outcomes[0].total,2);
});
test('resultados usan último cierre de cada activo; NFF y PoD no se etiquetan como reparación',()=>{
 const orders=['A','B','C'].map((serie,i)=>({codigo_os:'MV-'+i,tipo_equipo:'VALIDADOR',serie,fecha:'2026-01-01',falla:'Falla'}));
 const closures=[{codigo_os:'MV-0',fecha:'2026-01-02',resultado:'REPARADO'},{codigo_os:'MV-0',fecha:'2026-01-03',resultado:'NFF'},{codigo_os:'MV-1',fecha:'2026-01-02',resultado:'POD'}];
 const r=buildMaintenanceAnalysis({orders,closures},'2026-04-01');assert.equal(r.outcomes.reduce((n,x)=>n+x.total,0),3);assert.deepEqual(r.outcomes.map(x=>x.label).sort(),['NFF','POD','SIN_CIERRE']);
});
test('reposición usa salidas reales de 90 días, protege stock cero y no inventa plazo proveedor',()=>{
 const stock=[{id:1,nombre:'Lector',categoria:'VALIDADOR',stock:3,stock_critico:2},{id:2,nombre:'Cable',stock:0,stock_critico:4}];
 const deliveries=['2026-02-01','2026-03-01','2026-03-15'].map(fecha=>({repuesto_id:'1',cantidad:30,fecha,falla:'Falla QR'}));
 deliveries.push({repuesto_id:'1',cantidad:900,fecha:'2026-03-20',falla:'[SIMULACION] Falla'});
 const r=buildMaintenanceAnalysis({stock,deliveries},'2026-04-01');assert.equal(r.parts[0].realUnits90,90);assert.equal(r.parts[0].dailyRate,1);assert.equal(r.parts[0].coverageDays,3);assert.equal(r.parts[0].depletionDate,'2026-04-04T00:00:00.000Z');assert.equal(r.parts[0].suggestedUnits30,29);assert.equal(r.parts[0].leadTimeDays,null);assert.equal(r.parts[1].coverageDays,null);assert.equal(r.parts[1].minimumGap,4);assert.ok(r.alerts.some(a=>a.subject==='Cable'&&a.tone==='danger'));
});
test('historial insuficiente, simultáneo, futuro o sintético no permite estimar',()=>{
 const orders=Array.from({length:5},(_,i)=>({codigo_os:'MV-'+i,tipo_equipo:'VALIDADOR',serie:'A',fecha:'2026-03-01',falla:'[SIMULACION] prueba'}));
 const r=buildMaintenanceAnalysis({orders,stock:[{id:1,nombre:'Cable',stock:3}],deliveries:[{repuesto_id:1,cantidad:100,fecha:'2027-01-01',falla:'Falla'}]},'2026-04-01');assert.equal(r.assets[0].medianDays,null);assert.equal(r.assets[0].estimate,null);assert.equal(r.parts[0].units90,0);assert.equal(r.parts[0].suggestedUnits30,null);
});
import {installMockFirebaseCredential} from './helpers/mockFirebaseCredential.js';

test('analítica consulta un snapshot sin escritura ni parámetros de rol',async()=>{
 let queries=0;const result=await readOperationalInsights({query:async sql=>{queries++;assert.match(sql,/^WITH failures/);assert.doesNotMatch(sql,/LIMIT 10/);assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE|ALTER)\b/);return {rows:[{data:{summary:{orders:0},buses:[]}}]};}});
 assert.equal(queries,1);assert.equal(result.summary.orders,0);
});
test('nuevas consultas no conceden movimientos de otros departamentos',()=>{
 for(const rol of ['gerente','jefe_laboratorio','logistica'])assert.equal(permits({rol},'ai.read'),true);
 for(const action of ['warehouse.move','qa.work','terrain.work','users.manage','supervision.read'])assert.equal(permits({rol:'jefe_laboratorio'},action),false);
 assert.equal(permits({rol:'jefe_laboratorio'},'orders.list'),true);
 assert.equal(permits({rol:'jefe_laboratorio'},'operating-assets.read'),true);
});
const remove=installMockFirebaseCredential();
const {default:admin}=await import('../src/firebase.js');const {pool}=await import('../src/db.js');const {default:app}=await import('../src/app.js');
const auth=admin.auth(),verify=auth.verifyIdToken,query=pool.query;
const roles=['admin','gerente','jefe_laboratorio','logistica','qa','tecnico_laboratorio','tecnico_terreno'];let reads=0;
auth.verifyIdToken=async token=>({uid:token,email:token+'@fixture.test',rol:'admin'});
pool.query=async(sql,params=[])=>{assert.match(sql.trim(),/^(SELECT|WITH)/);if(sql.includes('WHERE firebase_uid=$1'))return {rows:[{id:params[0],firebase_uid:params[0],correo:params[1],rol:params[0],activo:true}],rowCount:1};reads++;return {rows:[{data:{summary:{orders:0}}}],rowCount:1};};
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
test.after(async()=>{auth.verifyIdToken=verify;pool.query=query;server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();remove();});
test('API de análisis verifica identidad y rol del servidor; consulta manipulada no amplía acceso',async()=>{
 for(const rol of roles){const before=reads;const res=await fetch(base+'/api/ai/operational-insights?rol=admin&scope=all',{headers:{authorization:'Bearer '+rol}});const allowed=['admin','gerente','jefe_laboratorio','logistica'].includes(rol);assert.equal(res.status,allowed?200:403);assert.equal(reads,before+(allowed?1:0));}
 assert.equal((await fetch(base+'/api/ai/operational-insights')).status,401);
 for(const rol of ['qa','tecnico_laboratorio','tecnico_terreno'])assert.equal((await fetch(base+'/api/ai/predictive-report?rol=admin',{headers:{authorization:'Bearer '+rol}})).status,403);
});
