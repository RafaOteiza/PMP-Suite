import {authorize} from '../security/authorization.js';
import { Router } from 'express';
import { pool } from '../db.js';
import { firebaseAuth } from '../middleware/firebaseAuth.js';
import { ensureUser } from '../middleware/ensureUser.js';
import { enforceReadOnlyRole } from '../middleware/readOnlyRole.js';
import { requireAnyRole } from '../middleware/requireAnyRole.js';
import { ROLES } from '../constants/roles.js';
import { sendFlowError } from '../services/bridgeFlow.js';
import { searchRegisteredAssets,registerAsset,startAssetReception,validateAssetReception } from '../services/assetManagement.js';
import { ScanError,recordRejectedScan } from '../services/equipmentScan.js';
function sendAssetError(res,e,next){if(e instanceof ScanError)return res.status(e.status).json({error:e.code,message:e.message});return sendFlowError(res,e,next);}
const router=Router();
router.use(firebaseAuth,ensureUser,enforceReadOnlyRole);
router.use((req,res,next)=>authorize(req.method==='GET'?'assets.read':'assets.register')(req,res,next));
router.get('/',async(req,res,next)=>{try{res.json(await searchRegisteredAssets(pool,req.query));}catch(e){sendFlowError(res,e,next);}});
router.post('/',async(req,res,next)=>{try{res.status(201).json(await registerAsset(pool,req.body,req.user));}catch(e){sendFlowError(res,e,next);}});
router.post('/recepcion/validar',async(req,res,next)=>{try{res.json(await validateAssetReception(pool,req.body,req.user));}catch(e){
  if(req.body.origen_captura==='SCANNER')await recordRejectedScan(pool,{code:req.body.codigo,station:'BODEGA',user:req.user,error:e});
  sendAssetError(res,e,next);
}});
router.post('/recepcion',async(req,res,next)=>{try{res.status(201).json(await startAssetReception(pool,req.body,req.user));}catch(e){sendAssetError(res,e,next);}});
export default router;
