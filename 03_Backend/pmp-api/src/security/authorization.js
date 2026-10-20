import {ROLES as R} from '../constants/roles.js';

// Explicit action/resource grants. There is deliberately no administrator wildcard.
export const POLICY=Object.freeze({
 'supervision.read':[R.ADMIN,R.GERENTE],
 'ai.read':[R.ADMIN,R.GERENTE,R.JEFE_LABORATORIO,R.LOGISTICA],
 'orders.list':[R.ADMIN,R.GERENTE,R.JEFE_LABORATORIO],
 'operating-assets.read':[R.ADMIN,R.GERENTE,R.JEFE_LABORATORIO,R.LOGISTICA],
 'lab.read':[R.ADMIN,R.GERENTE,R.JEFE_LABORATORIO,R.TECNICO_LAB],
 'lab.supervise':[R.ADMIN,R.GERENTE,R.JEFE_LABORATORIO],
 'lab.custody':[R.JEFE_LABORATORIO],
 'lab.assign':[R.JEFE_LABORATORIO],
 'lab.work':[R.TECNICO_LAB],
 'warehouse.read':[R.ADMIN,R.GERENTE,R.LOGISTICA],
 'warehouse.move':[R.LOGISTICA],
 'warehouse.stock':[R.LOGISTICA],
 'assets.read':[R.ADMIN,R.LOGISTICA],
 'assets.register':[R.LOGISTICA],
 'requirements.read':[R.ADMIN,R.GERENTE,R.LOGISTICA,R.TECNICO_LAB,R.QA],
 'requirements.catalog':[R.ADMIN,R.LOGISTICA],
 'requirements.create':[R.LOGISTICA],
 'terrain.assign.read':[R.ADMIN,R.LOGISTICA],
 'terrain.assign':[R.LOGISTICA],
 'terrain.work':[R.TECNICO_TERRENO],
 'orders.read':[R.ADMIN,R.GERENTE,R.TECNICO_LAB,R.TECNICO_TERRENO],
 'qa.read':[R.ADMIN,R.GERENTE,R.QA],
 'qa.work':[R.QA],
 'scan.read':[R.ADMIN,R.GERENTE,R.JEFE_LABORATORIO,R.LOGISTICA,R.TECNICO_LAB,R.QA],
 'scan.validate':[R.JEFE_LABORATORIO,R.LOGISTICA,R.QA],
 'bridge.read':[R.ADMIN,R.GERENTE,R.LOGISTICA,R.TECNICO_LAB,R.QA],
 'bridge.link':[R.LOGISTICA],
 'users.manage':[R.ADMIN]
});
export function permits(user,action,resource){
 if(!user||user.activo===false||!POLICY[action]?.includes(user.rol))return false;
 if(resource&&action==='lab.work')return String(resource.tecnico_laboratorio_id||'')===String(user.id);
 if(resource&&action==='terrain.work')return String(resource.tecnico_terreno_id||'')===String(user.id);
 return true;
}
export function auditAuthorization(user,action,result){
 // Intentionally excludes request bodies, emails, passwords, tokens and Firebase identifiers.
 console.info('[AUTHORIZATION]',{actor:user?.id||null,role:user?.rol||null,action,result,at:new Date().toISOString()});
}
export function authorize(action){
 return (req,res,next)=>{
  if(!permits(req.user,action)){auditAuthorization(req.user,action,'denied');return res.status(403).json({error:'FORBIDDEN',message:'Tu rol no autoriza esta acción.'});}
  req.authorizedAction=action;
  if(req.method&&!['GET','HEAD','OPTIONS'].includes(req.method))res.once?.('finish',()=>auditAuthorization(req.user,action,res.statusCode<400?'allowed':'rejected'));
  next();
 };
}
