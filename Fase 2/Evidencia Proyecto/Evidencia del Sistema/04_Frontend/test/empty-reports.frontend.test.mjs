import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
globalThis.__reportFixture={response:null};
const mocks=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};
export const api={get:async()=>{const value=globalThis.__reportFixture.response;if(value instanceof Error)throw value;return {data:value};}};
export const useOutletContext=()=>({rol:'admin'});
export default function Component({children,title,value,label,actions}){return React.createElement('section',null,title,label,value,children,actions);}
export const Bar=Component,BarChart=Component,CartesianGrid=Component,Cell=Component,Legend=Component,Pie=Component,PieChart=Component,ResponsiveContainer=Component,Tooltip=Component,XAxis=Component,YAxis=Component;
export const Clock=()=>null,Download=Clock,FileSpreadsheet=Clock,FileText=Clock,Gauge=Clock,RefreshCw=Clock,TrendingUp=Clock,Wrench=Clock;`);
const source=await readFile(new URL('../src/pages/LabReportesPage.tsx',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {default:Page}=await import(url(js.replace(/from (["'])([^"']+)\1/g,(_,q,name)=>`from ${JSON.stringify(name==='react'||name==='react/jsx-runtime'?import.meta.resolve(name):mocks)}`)));
for(const [label,response] of [['API no disponible',new Error('404')],['respuesta incompleta',{}],['métrica no finita',{eficienciaSemanal:NaN}]])test(label+' no fabrica métricas ni habilita exportación',async()=>{
 globalThis.__reportFixture.response=response;let render;await act(async()=>{render=TestRenderer.create(React.createElement(Page));});
 const text=JSON.stringify(render.toJSON());assert.match(text,/No hay mediciones verificadas/);assert.doesNotMatch(text,/18\.5|92%|NaN/);
 assert.equal(render.root.findAllByType('button').length,1);await act(async()=>render.unmount());
});
test('un reporte real vacío conserva ceros y colecciones vacías',async()=>{
 globalThis.__reportFixture.response={eficienciaSemanal:0,totalReparados:0,totalEnProceso:0,tiempoPromedioHoras:0,fallas:[],porTecnico:[],porTipo:[]};
 let render;await act(async()=>{render=TestRenderer.create(React.createElement(Page));});
 const text=JSON.stringify(render.toJSON());assert.match(text,/0%/);assert.doesNotMatch(text,/No hay mediciones verificadas|NaN|18\.5|José Villarroel/);await act(async()=>render.unmount());
});
