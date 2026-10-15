import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from 'node:fs/promises';
import { installMockFirebaseCredential } from "./helpers/mockFirebaseCredential.js";

const removeMockFirebaseCredential = installMockFirebaseCredential();
test.after(removeMockFirebaseCredential);

const { default: app } = await import("../src/app.js");

test('todos los endpoints montados rechazan acceso sin autenticación antes de consultar datos',async t=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>new Promise(r=>server.close(r)));
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const imports=new Map([...source.matchAll(/import\s+(\w+)\s+from\s+["'](\.\/routes\/[^"']+)["']/g)].map(m=>[m[1],m[2]]));
 let checked=0;
 for(const mount of source.matchAll(/^app\.use\(["']([^"']+)["'],\s*(\w+)\)/gm)){
  const file=imports.get(mount[2]);if(!file)continue;
  const router=(await import(new URL('../src/'+file,import.meta.url))).default;
  for(const layer of router.stack){if(!layer.route)continue;
   for(const routePath of [layer.route.path].flat()){
   const path=mount[1]+routePath.replace(/:\w+/g,'fixture');
   for(const method of Object.keys(layer.route.methods)){
    const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:method.toUpperCase(),...(method==='get'?{}:{headers:{'Content-Type':'application/json'},body:'{}'})});
    assert.equal(response.status,401,method+' '+path);checked++;
   }
  }}
 }
 assert.ok(checked>70,`Se deben inventariar los endpoints reales: ${checked}`);
 t.diagnostic(`${checked} entradas HTTP verificadas con middleware real y sin token.`);
});

test("smoke HTTP: health funciona y admin rechaza solicitudes sin token", async (t) => {
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  }));

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);

  const stats = await fetch(`${baseUrl}/api/admin/stats`);
  assert.equal(stats.status, 401);

  const dispatch = await fetch(`${baseUrl}/api/admin/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ codigos_os: ["NO-DEBE-EJECUTARSE"] })
  });
  assert.equal(dispatch.status, 401);
});
