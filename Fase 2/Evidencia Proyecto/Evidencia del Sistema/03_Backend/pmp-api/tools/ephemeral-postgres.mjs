// Isolated test/recovery verification instance. No persistent demo or fixed port.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,basename,sep} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {local,pool,pgBin,pgEnv,program,quote,sourceUrl} from './database-tools.mjs';

export function assertEphemeralPath(path){
 const base=realpathSync(local),actual=realpathSync(path);
 assert.ok(actual.startsWith(base+sep)&&basename(actual).startsWith('pg-ephemeral-'),'Refuse non-temporary directory');
 return actual;
}
export async function ephemeralPostgres(){
 mkdirSync(local,{recursive:true});
 const dir=mkdtempSync(resolve(local,'pg-ephemeral-')),data=resolve(dir,'data');
 const probe=createServer();await new Promise((res,rej)=>{probe.once('error',rej);probe.listen(0,'127.0.0.1',res);});const port=probe.address().port;await new Promise(r=>probe.close(r));
 assert.ok(![5432,55435].includes(port));
 const password=randomBytes(30).toString('base64url'),passfile=resolve(dir,'password.txt');writeFileSync(passfile,password);
 const url=`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;let started=false;
 const dispose=async()=>{
  const target=assertEphemeralPath(dir);
  if(started){program(resolve(pgBin(),'pg_ctl.exe'),['--pgdata',data,'--mode','fast','--wait','stop'],{stdio:'ignore'});started=false;}
  // Native PowerShell end-to-end deletion, after resolving and bounding the exact path.
  program('powershell.exe',['-NoProfile','-Command',`$ErrorActionPreference='Stop'; Remove-Item -LiteralPath '${target.replaceAll("'","''")}' -Recurse -Force`],{encoding:'utf8'});
 };
 try{
  program(resolve(pgBin(),'initdb.exe'),['--pgdata',data,'--username','postgres','--pwfile',passfile,'--auth=scram-sha-256','--encoding=UTF8','--no-locale']);
  program(resolve(pgBin(),'pg_ctl.exe'),['--pgdata',data,'--log',resolve(dir,'postgres.log'),'--options',`-h 127.0.0.1 -p ${port}`,'--wait','start'],{stdio:'ignore'});started=true;
  return {url,dir,port,dispose};
 }catch(e){await dispose();throw e;}
}

export async function emptyFixtureDatabase(){
 const fixture=await ephemeralPostgres();let source,test;
 try{
  const schema=resolve(fixture.dir,'schema.dump');
  program(resolve(pgBin(),'pg_dump.exe'),['--schema-only','--format=custom','--no-owner','--no-privileges','--file',schema],{env:pgEnv(sourceUrl())});
  program(resolve(pgBin(),'pg_restore.exe'),['--exit-on-error','--single-transaction','--dbname','postgres',schema],{env:pgEnv(fixture.url)});
  source=pool(sourceUrl(),true);test=pool(fixture.url);
  for(const table of ['estados','ubicaciones','config_estado_ubicacion','repuestos']){
   const rows=(await source.query('SELECT * FROM pmp.'+quote(table))).rows;
   if(table==='repuestos')rows.forEach(r=>r.stock=0);
   await test.query(`INSERT INTO pmp.${quote(table)} SELECT * FROM jsonb_populate_recordset(NULL::pmp.${quote(table)},$1::jsonb)`,[JSON.stringify(rows)]);
  }
  await test.query("INSERT INTO pmp.buses(ppu) VALUES('BJ2149')");
  await test.query("INSERT INTO pmp.terminales(id,nombre) VALUES(1,'El Conquistador')");
  await test.query("INSERT INTO pmp.pst(codigo,nombre) VALUES('U15','VOYSANTIAGO')");
  await test.query("INSERT INTO pmp.terminal_pst(terminal_id,pst_codigo) VALUES(1,'U15')");
  for(const role of ['admin','logistica','tecnico_terreno','tecnico_laboratorio','qa','gerente','jefe_laboratorio'])await test.query('INSERT INTO pmp.usuarios(id,nombre,apellido,correo,rol,activo,firebase_uid) VALUES($1,$2,$3,$4,$5,true,$6)',[randomUUID(),'Fixture',role,role+'@pmp-suite.test',role,'isolated-'+role]);
  return fixture;
 }catch(e){if(test){await test.end();test=null;}await fixture.dispose();throw e;}finally{if(source)await source.end();if(test)await test.end();}
}
