import {authorize} from '../security/authorization.js';
import { Router } from 'express';
import { pool } from '../db.js';
import { firebaseAuth } from '../middleware/firebaseAuth.js';
import { ensureUser } from '../middleware/ensureUser.js';
import { enforceReadOnlyRole } from '../middleware/readOnlyRole.js';
import { requireAnyRole } from '../middleware/requireAnyRole.js';
import { ROLES } from '../constants/roles.js';
import { sendFlowError } from '../services/bridgeFlow.js';
import { createRequirement, listCases, getCase, derivePod } from '../services/requirements.js';
import { searchRequirementAssets, searchRequirementBuses, activeRequirementOrders } from '../services/requirementSearch.js';
const router=Router();
router.use(firebaseAuth,ensureUser,enforceReadOnlyRole);
for(const [path,query] of [['/operativos',searchRequirementAssets],['/buses',searchRequirementBuses],['/intervenciones-activas',activeRequirementOrders]]) {
  router.get(path,authorize('requirements.catalog'),async(req,res,next)=>{
    try {res.json(await query(pool,req.query));}catch(error){sendFlowError(res,error,next);}
  });
}
router.get('/',authorize('requirements.read'),async(req,res,next)=>{
  try {res.json(await listCases(pool,req.query.q,req.query));} catch(error){sendFlowError(res,error,next);}
});
router.get('/:id',authorize('requirements.read'),async(req,res,next)=>{
  try {res.json(await getCase(pool,req.params.id));} catch(error){sendFlowError(res,error,next);}
});
router.post('/',authorize('requirements.create'),async(req,res,next)=>{
  try {res.status(201).json(await createRequirement(pool,req.body,req.user));} catch(error){sendFlowError(res,error,next);}
});
router.post('/:id/pod',authorize('requirements.create'),async(req,res,next)=>{
  try {res.status(201).json(await derivePod(pool,req.params.id,req.body,req.user));} catch(error){sendFlowError(res,error,next);}
});
export default router;
