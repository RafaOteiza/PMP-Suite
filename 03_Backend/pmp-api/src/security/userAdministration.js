import {FlowError} from '../services/bridgeFlow.js';
import {VALID_ROLES} from '../constants/roles.js';

// All account mutations take the same transaction lock before reading/changing roles.
// This also prevents two administrators from concurrently removing the last admin.
export async function lockUserAdministration(client,actor){
 await client.query('LOCK TABLE pmp.usuarios IN SHARE ROW EXCLUSIVE MODE');
 const current=(await client.query('SELECT id,rol,activo FROM pmp.usuarios WHERE id=$1',[actor.id])).rows[0];
 if(!current||current.rol!=='admin'||current.activo!==true)
  throw new FlowError(403,'ADMIN_REQUIRED','La cuenta ya no tiene autorización administrativa.');
}
export async function protectUserChange(client,actor,id,{rol,activo}={}){
 const row=(await client.query('SELECT id,rol,activo FROM pmp.usuarios WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(!row)throw new FlowError(404,'USER_NOT_FOUND','Usuario no encontrado.');
 if(rol!=null&&!VALID_ROLES.includes(rol))throw new FlowError(422,'INVALID_ROLE','Rol no autorizado.');
 if(String(actor.id)===String(row.id)&&((rol!=null&&rol!==row.rol)||activo===false))
  throw new FlowError(403,'SELF_PRIVILEGE_CHANGE','No puedes cambiar tu propio rol ni desactivar tu cuenta.');
 if(row.rol==='admin'&&row.activo&&((rol!=null&&rol!=='admin')||activo===false)){
  const count=Number((await client.query("SELECT count(*) n FROM pmp.usuarios WHERE rol='admin' AND activo=true")).rows[0].n);
  if(count<=1)throw new FlowError(409,'LAST_ADMIN','Debe permanecer al menos un administrador activo.');
 }
 return row;
}
