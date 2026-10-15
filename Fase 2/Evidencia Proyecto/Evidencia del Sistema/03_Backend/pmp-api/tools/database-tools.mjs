import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parse} from 'dotenv';
import pg from 'pg';
export const backend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const root=resolve(backend,'../..');
export const local=resolve(root,'.local/pmp-verification');
export const permanentBackup=resolve(root,'Respaldos/PMP_Suite/manual');
export const quote=s=>'"'+String(s).replaceAll('"','""')+'"';
export const literal=s=>"'"+String(s).replaceAll("'","''")+"'";
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const sourceEnv=()=>parse(readFileSync(resolve(backend,'.env')));
export function sourceUrl(){const u=new URL(sourceEnv().DATABASE_URL);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/pmp_suite')throw Error('La conexión original no corresponde a pmp_suite local. Revisar explícitamente antes de preparar.');return u;}
export const withDb=(url,name)=>{const u=new URL(url);u.pathname='/'+name;return u.toString();};
export const safeIdentity=url=>{const u=new URL(url);return {host:u.hostname,port:Number(u.port||5432),database:decodeURIComponent(u.pathname.slice(1))};};
export const pool=(url,readonly=false)=>new pg.Pool({connectionString:String(url),options:'-c timezone=UTC'+(readonly?' -c default_transaction_read_only=on':'')});
export const pgBin=()=>{const result=[process.env.POSTGRES_BIN,'C:/Program Files/PostgreSQL/18/bin','C:/Program Files/PostgreSQL/17/bin'].filter(Boolean).find(p=>existsSync(resolve(p,'pg_dump.exe')));if(!result)throw Error('No se encontró PostgreSQL local');return result;};
export const pgEnv=url=>{const u=new URL(url);return {...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password)};};
export function program(executable,args,options={}){const r=spawnSync(executable,args,{windowsHide:true,maxBuffer:64*1024*1024,...options});if(r.status!==0){mkdirSync(local,{recursive:true});writeFileSync(resolve(local,'last-tool-error.log'),r.stderr||r.error?.message||'Unknown error');throw Error(basename(executable)+' falló. Diagnóstico privado: .local/pmp-verification/last-tool-error.log');}return r.stdout;}
export const save=(name,data)=>{mkdirSync(local,{recursive:true});writeFileSync(resolve(local,name),JSON.stringify(data,null,2)+'\n');};
export const tables=async c=>(await c.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2")).rows;
export async function fingerprint(c){const result={};for(const t of await tables(c)){const table=quote(t.schemaname)+'.'+quote(t.tablename);result[table]=(await c.query(`SELECT count(*)::int count,md5(COALESCE(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) hash FROM ${table} t`)).rows[0];}return result;}
export async function sequences(c){const result={};for(const s of (await c.query("select schemaname,sequencename from pg_sequences where schemaname NOT IN ('pg_catalog','information_schema') order by 1,2")).rows){result[s.schemaname+'.'+s.sequencename]=(await c.query(`select last_value::text,is_called from ${quote(s.schemaname)}.${quote(s.sequencename)}`)).rows[0];}return result;}
// PostgreSQL can deparse restored varchar-array checks as per-element text casts.
// Normalize only that equivalent cast representation, retaining boolean grouping and predicates.
export const normalizedDefinition=s=>s.replace(/\(\(ARRAY\[(.*?)\]\)::text\[\]\)/g,(_,items)=>'(ARRAY['+items.replace(/('[^']*'::character varying)/g,'($1)::text')+'])');
export async function structure(c){const queries={constraints:"select conrelid::regclass::text table_name,conname,pg_get_constraintdef(oid) definition from pg_constraint where connamespace='pmp'::regnamespace order by 1,2",triggers:"select tgrelid::regclass::text table_name,tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where NOT tgisinternal order by 1,2",functions:"select proname,pg_get_functiondef(oid) definition from pg_proc where pronamespace='pmp'::regnamespace order by 1",indexes:"select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname='pmp' order by 1,2,3",views:"select viewname,definition from pg_views where schemaname='pmp' order by 1",columns:"select table_schema,table_name,column_name,data_type,column_default,is_nullable from information_schema.columns where table_schema='pmp' order by table_name,ordinal_position"};const result={};for(const [k,q] of Object.entries(queries)){const r=(await c.query(q)).rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='string'?normalizedDefinition(value):value]))).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0);result[k]={count:r.length,sha256:hash(JSON.stringify(r))};}return result;}
export const configuration=['estados','ubicaciones','usuarios','terminales','pst','terminal_pst','buses','config_estado_ubicacion','repuestos'];
export const operational=['bridge_mantenimiento','bridge_referencias','bridges','casos_operacionales','consolas','escaneos_equipos','flujo_eventos','guia_detalle','guias','instalaciones_equipos','ordenes_servicio','os_historial_activo','qa_inspecciones','registro_reparaciones','solicitud_items','solicitudes_repuestos','validadores'];
export function assertKnownTables(found){const expected=[...configuration,...operational].sort();const actual=found.map(t=>t.schemaname==='pmp'?t.tablename:t.schemaname+'.'+t.tablename).sort();if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('El esquema cambió: revisar y clasificar las tablas antes de copiar datos.');}
export async function initialCounts(c){const result={};for(const t of [...configuration,...operational])result[t]=Number((await c.query(`select count(*) n from pmp.${quote(t)}`)).rows[0].n);return result;}

