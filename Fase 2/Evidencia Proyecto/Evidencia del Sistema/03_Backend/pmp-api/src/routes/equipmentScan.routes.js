import {authorize} from '../security/authorization.js';
import {sendFlowError,FlowError} from '../services/bridgeFlow.js';
import { Router } from "express";
import { pool } from "../db.js";
import { firebaseAuth } from "../middleware/firebaseAuth.js";
import { ensureUser } from "../middleware/ensureUser.js";
import { enforceReadOnlyRole } from "../middleware/readOnlyRole.js";
import { requireAnyRole } from "../middleware/requireAnyRole.js";
import { ROLES } from "../constants/roles.js";
import {
  ScanError,
  canConfirmAtStation,
  normalizeStation,
  confirmEquipmentScan,
  recordRejectedScan,
  resolveEquipmentScan
} from "../services/equipmentScan.js";

const router = Router();

router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);

function sendScanError(res, error, next) {
  if (error instanceof ScanError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  return sendFlowError(res,error,next);
}

router.get("/resolve", authorize('scan.read'), async (req, res, next) => {
  try {
    if(req.user.rol===ROLES.JEFE_LABORATORIO&&normalizeStation(req.query.estacion)!=='LABORATORIO')throw new FlowError(403,'FORBIDDEN','La jefatura consulta la estación de Laboratorio');
    const resolution = await resolveEquipmentScan(pool, {
      code: req.query.codigo,
      station: req.query.estacion,
      user: req.user
    });
    return res.json(resolution);
  } catch (error) {
    return sendScanError(res, error, next);
  }
});

router.post("/confirm", authorize('scan.validate'), async (req, res, next) => {
  try {
    const station=normalizeStation(req.body?.estacion);
    if(!canConfirmAtStation(req.user.rol,station))throw new FlowError(403,'STATION_FORBIDDEN','Tu rol no autoriza operaciones en esta estación');
    if(station==='QA'&&req.user.rol!==ROLES.QA)throw new FlowError(403,'QA_ROLE_REQUIRED','La recepción QA corresponde al rol QA');
    if(station==='QA')throw new FlowError(409,'QA_EXPLICIT_RECEIPT_REQUIRED','Abre Recepción QA y confirma explícitamente la llegada con evidencia propia');
    throw new FlowError(409,'EXPLICIT_CUSTODY_REQUIRED','La estación identifica el activo. Abre la operación de recepción o despacho y confirma con evidencia propia.');
  } catch (error) {
    if (error instanceof ScanError) {
      await recordRejectedScan(pool, {
        code: req.body?.codigo,
        station: req.body?.estacion,
        user: req.user,
        error
      });
    }
    return sendScanError(res, error, next);
  }
});

export default router;
