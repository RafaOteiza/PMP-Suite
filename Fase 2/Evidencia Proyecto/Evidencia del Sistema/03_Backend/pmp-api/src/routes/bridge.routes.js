import {authorize} from '../security/authorization.js';
import { Router } from 'express';
import { pool } from '../db.js';
import { firebaseAuth } from '../middleware/firebaseAuth.js';
import { ensureUser } from '../middleware/ensureUser.js';
import { enforceReadOnlyRole } from '../middleware/readOnlyRole.js';
import { requireAnyRole } from '../middleware/requireAnyRole.js';
import { ROLES } from '../constants/roles.js';
import { createCorrelation, searchAssets, getAssetHistory } from '../services/assetHistory.js';
import { sendFlowError, FlowError } from '../services/bridgeFlow.js';
import { getTechnicalAssetHistory } from '../services/technicalAssetHistory.js';

const router = Router();
function historyError(req,res,error,next) {
  if([ROLES.TECNICO_TERRENO,ROLES.JEFE_LABORATORIO].includes(req.user.rol)&&!(error instanceof FlowError))
    return res.status(500).json({message:'No se pudo consultar el historial técnico.'});
  sendFlowError(res,error,next);
}
router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);
router.use(requireAnyRole(ROLES.ADMIN,ROLES.GERENTE,ROLES.JEFE_LABORATORIO,ROLES.LOGISTICA,ROLES.TECNICO_TERRENO,ROLES.TECNICO_LAB,ROLES.QA));
router.get('/buscar', async (req,res,next) => {
  try { res.json(req.query.q ? await searchAssets(pool,req.query.q) : []); }
  catch (error) { historyError(req,res,error,next); }
});
router.get('/activos/:tipo/:serie/historial', async (req,res,next) => {
  try {
    const read=[ROLES.TECNICO_TERRENO,ROLES.JEFE_LABORATORIO].includes(req.user.rol)?getTechnicalAssetHistory:getAssetHistory;
    res.json(await read(pool,req.params.tipo,req.params.serie));
  }
  catch (error) { historyError(req,res,error,next); }
});
router.get('/', authorize('bridge.read'), async (req,res,next) => {
  try { res.json((await pool.query('SELECT * FROM pmp.v_referencias_activo ORDER BY fecha DESC,id')).rows); }
  catch (error) { sendFlowError(res,error,next); }
});
router.post('/', authorize('bridge.link'), async (req,res,next) => {
  try { res.status(201).json({ referencia: await createCorrelation(pool,req.body,req.user) }); }
  catch (error) { sendFlowError(res,error,next); }
});
// Retire every old operational URL, including maintenance actions.
router.use((req,res) => res.status(410).json({ error:'BRIDGE_CORRELATION_ONLY',
  message:'Bridge solo vincula referencias. Utiliza el flujo normal de OS PMP para operar.' }));
export default router;
