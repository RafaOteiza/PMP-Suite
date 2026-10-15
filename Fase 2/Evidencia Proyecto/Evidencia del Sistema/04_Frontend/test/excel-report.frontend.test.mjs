import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import * as XLSX from 'xlsx';
const source=await readFile(new URL('../src/utils/excelReport.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {collectReportPages,reportRows,canExportReports,downloadExcel,buildExcelWorkbook}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('Excel: consulta todas las páginas, no solo la visible',async()=>{
 const offsets=[];const values=Array.from({length:207},(_,i)=>({id:String(i)}));
 const rows=await collectReportPages(async offset=>{offsets.push(offset);return {items:values.slice(offset,offset+100),total:207};},r=>r.id);
 assert.equal(rows.length,207);assert.deepEqual(offsets,[0,100,200]);
});
test('Excel: una falla, un total cambiante o páginas repetidas impiden un informe parcial',async()=>{
 await assert.rejects(collectReportPages(async offset=>{if(offset)throw Error('network');return {items:[{id:'1'}],total:2};},r=>r.id),/network/);
 await assert.rejects(collectReportPages(async offset=>({items:[{id:String(offset)}],total:offset?3:2}),r=>r.id),/cambiaron/);
 await assert.rejects(collectReportPages(async()=>({items:[{id:'1'}]}),r=>r.id),/repetidos/);
 await assert.rejects(collectReportPages(async()=>({items:[],total:1}),r=>r.id),/incompleto/);
});
test('Excel: roles técnicos, QA y desconocidos no descargan ni consultan',async()=>{
 for(const role of ['qa','tecnico_laboratorio','tecnico_terreno','unknown','']){
  assert.equal(canExportReports(role),false);
  await assert.rejects(downloadExcel({title:'Test',load:()=>assert.fail('No debe consultar')},role),/rol/);
 }
 for(const role of ['admin','gerente','jefe_laboratorio','logistica'])assert.equal(canExportReports(role),true);
});
test('Excel: archivos reales conservan series como texto y neutralizan fórmulas sin secretos',()=>{
 const rows=reportRows([{serie:'9715B669769901',falla:'=HYPERLINK("evil")',firebase_uid:'SECRET',password:'SECRET',metadata:{token:'SECRET'},id:123,stock:0}]);
 const book=buildExcelWorkbook(XLSX,{title:'Prueba aislada',filters:{tipo:'CONSOLA'}},[{name:'Equipos',rows},{name:'Vacío',rows:[]}]);
 const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'}),reopened=XLSX.read(bytes,{type:'buffer'});
 const sheet=reopened.Sheets.Equipos;
 assert.equal(sheet.A2.v,'9715B669769901');assert.equal(sheet.A2.t,'s');
 assert.ok(Object.values(sheet).some(c=>c.v==='=HYPERLINK("evil")'&&c.t==='s'&&!c.f));
 assert.doesNotMatch(JSON.stringify(book),/SECRET|firebase_uid|password/);
 assert.ok(XLSX.utils.sheet_to_json(reopened.Sheets.Información).some(r=>r.Campo==='Filtro: tipo'&&r.Valor==='CONSOLA'));
 assert.match(JSON.stringify(reopened.Sheets.Vacío),/Sin registros/);
});
