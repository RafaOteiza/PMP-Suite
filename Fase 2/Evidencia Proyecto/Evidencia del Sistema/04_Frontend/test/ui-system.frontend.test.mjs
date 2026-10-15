import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
async function compile(file,imports={}) {const source=await readFile(new URL('../src/'+file,import.meta.url),'utf8');return url(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from (["'])([^"']+)\1/g,(_,q,name)=>'from '+JSON.stringify(imports[name]||import.meta.resolve(name))));}
const health=await compile('utils/health.ts');
const {healthFromStatusName}=await import(health);
const semantic=await compile('components/ui/SemanticIndicator.tsx',{'../../utils/health':health});
const imports={'../../utils/health':health,'./SemanticIndicator':semantic};
const {default:Badge}=await import(await compile('components/ui/StatusBadge.tsx',imports));
const {default:Stat}=await import(await compile('components/ui/StatCard.tsx',imports));
for(const [expected,labels] of Object.entries({success:['Disponible para instalación','En operación','Operativo','Aprobado','Completo','Equipo validado'],warning:['No disponible','Pendiente de retiro','Por verificar','Sin asignar','Observación','Pendiente validación'],danger:['No aprobado','Rechazado','SLA vencido','Bloqueado','Fuera de servicio','Error'],info:['En tránsito','En ruta','En diagnóstico','En reparación','Recepción QA'],neutral:['Sin datos','Sin mediciones','No aplica','Inactivo']})) {
 for(const label of labels)test('Semáforo: '+label+' → '+expected,()=>assert.equal(healthFromStatusName(label),expected));
}
test('Badge conserva texto e incorpora significado sin depender solo del color',()=>{
 const r=TestRenderer.create(React.createElement(Badge,null,'Pendiente de retiro'));
 assert.equal(r.root.findByType('span').props['data-health'],'warning');assert.ok(r.root.findAllByType('svg').length);assert.ok(r.root.findByType('span').children.includes('Pendiente de retiro'));r.unmount();
});
test('Badge respeta una severidad explícita de la vista',()=>{
 const r=TestRenderer.create(React.createElement(Badge,{health:'danger'},'Revisar'));assert.equal(r.root.findByType('span').props['data-tone'],'danger');r.unmount();
});

test('Negaciones y ausencia de falla conservan su significado visual',()=>{
 for(const label of ['Sin falla encontrada','Reparado en laboratorio','Sin pendientes'])assert.equal(healthFromStatusName(label),'success');
 for(const label of ['No operativo','No reparable'])assert.equal(healthFromStatusName(label),'danger');
});

test('Badges de flujo anteriores siguen el semáforo incluso junto a iconos',()=>{
 for(const [label,expected] of [['En operación','success'],['Pendiente','warning'],['En tránsito','info'],['Rechazado','danger']]) {
  const r=TestRenderer.create(React.createElement(Badge,{health:'flow'},React.createElement('svg'),label));
  assert.equal(r.root.findByType('span').props['data-health'],expected);r.unmount();
 }
});
test('KPI: dato ausente neutral, cero es medición válida; no altera el valor',()=>{
 for(const [value,expected] of [['—','neutral'],[0,'success'],[3,'success']]){
 const r=TestRenderer.create(React.createElement(Stat,{label:'Disponibles',value,health:'success',icon:null}));assert.equal(r.root.findByType('article').props['data-health'],expected);assert.equal(r.root.findByProps({className:'stat-value'}).children[0],String(value));r.unmount();}
});
test('KPI interactivo conserva Enter/Espacio; un KPI sin acción no simula un enlace',async()=>{
 let calls=0;const r=TestRenderer.create(React.createElement(Stat,{label:'Inventario',value:1,icon:null,onClick:()=>calls++}));const a=r.root.findByType('article');
 assert.equal(a.props.role,'link');assert.equal(a.props.tabIndex,0);
 for(const key of ['Enter',' '])await act(async()=>a.props.onKeyDown({key,preventDefault(){}}));assert.equal(calls,2);r.unmount();
 const plain=TestRenderer.create(React.createElement(Stat,{label:'Inventario',value:1,icon:null}));assert.equal(plain.root.findByType('article').props.role,undefined);plain.unmount();
});
