import {authorize} from '../security/authorization.js';
import {Router} from 'express';
import {pool} from '../db.js';
import {firebaseAuth} from '../middleware/firebaseAuth.js';
import {ensureUser} from '../middleware/ensureUser.js';
import {requireAnyRole} from '../middleware/requireAnyRole.js';
import {enforceReadOnlyRole} from '../middleware/readOnlyRole.js';
import {ROLES} from '../constants/roles.js';
import {sendFlowError} from '../services/bridgeFlow.js';
import {qaDashboard,qaDetail,qaCommand,validateQaPhysical} from '../services/qaWork.js';
const router=Router();
router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);
const handle=fn=>async(req,res,next)=>{try{res.json(await fn(req));}catch(e){sendFlowError(res,e,next);}};
router.get('/dashboard',authorize('qa.read'),handle(req=>qaDashboard(pool,req.query)));
// Compatibility reads use the same custody predicates; no administrative assignment queue.
router.get('/queue',authorize('qa.read'),handle(async()=>{
 const stages=await Promise.all(['AMBIENTE','PRUEBAS','DESPACHO'].map(etapa=>qaDashboard(pool,{etapa})));
 return stages.flatMap(s=>s.items);
}));
router.get('/incoming',authorize('qa.read'),handle(async()=> (await qaDashboard(pool,{etapa:'RECEPCION'})).items));
router.put('/assign',authorize('qa.work'),(req,res)=>res.status(410).json({message:'La asignación administrativa fue retirada. QA toma su propio trabajo.'}));
router.post(['/start','/process'],authorize('qa.work'),(req,res)=>res.status(410).json({message:'Utiliza las etapas de Mi operación QA; el dictamen no confirma despacho.'}));
router.get('/:code/work',authorize('qa.read'),handle(req=>qaDetail(pool,req.params.code,req.query.ciclo)));
router.post('/:code/:purpose/validar',authorize('qa.work'),handle(req=>validateQaPhysical(pool,req.params.code,req.params.purpose,req.body,req.user)));
router.post('/:code/actions/:action',authorize('qa.work'),handle(req=>qaCommand(pool,req.params.code,req.params.action,req.body,req.user)));
export default router;
