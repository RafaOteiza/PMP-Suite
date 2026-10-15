import {authorize} from '../security/authorization.js';
import { Router } from "express";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { firebaseAuth } from "../middleware/firebaseAuth.js";
import { ensureUser } from "../middleware/ensureUser.js";
import { enforceReadOnlyRole } from "../middleware/readOnlyRole.js";
import {pool} from '../db.js';
import {readOperationalInsights} from '../services/operationalInsights.js';

const router = Router();
router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const aiRoot = path.join(currentDirectory, "../../../../06_ModelosIA");
const pythonExecutable = process.platform === "win32"
    ? path.join(aiRoot, ".venv", "Scripts", "python.exe")
    : path.join(aiRoot, ".venv", "bin", "python");
const scriptPath = path.join(aiRoot, "src", "analyzer.py");

/**
 * GET /api/ai/predictive-report
 * Ejecuta el analizador Python usando el entorno aislado del módulo IA.
 */
router.get('/operational-insights', authorize('ai.read'), async (req,res,next) => {
    try { res.json(await readOperationalInsights(pool)); } catch(error) { next(error); }
});

router.get("/predictive-report", authorize('ai.read'), (req, res) => {
    if (!fs.existsSync(pythonExecutable)) {
        console.error("AI runtime unavailable", { code: "PYTHON_RUNTIME_NOT_FOUND" });
        return res.status(503).json({
            error: "AI_SERVICE_UNAVAILABLE",
            message: "El servicio de inteligencia operacional no está disponible temporalmente"
        });
    }

    execFile(pythonExecutable, [scriptPath, "--json"], {
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 1024 * 1024
    }, (error, stdout) => {
        if (error) {
            console.error("AI service execution failed", {
                code: error.code ?? "AI_PROCESS_ERROR",
                signal: error.signal ?? null,
                killed: Boolean(error.killed)
            });
            return res.status(503).json({
                error: "AI_SERVICE_UNAVAILABLE",
                message: "El servicio de inteligencia operacional no está disponible temporalmente"
            });
        }

        try {
            return res.json(JSON.parse(stdout));
        } catch (parseError) {
            console.error("AI service returned an invalid payload", {
                error: parseError?.name ?? "PARSE_ERROR"
            });
            return res.status(502).json({
                error: "AI_INVALID_RESPONSE",
                message: "El servicio de inteligencia operacional entregó una respuesta inválida"
            });
        }
    });
});

export default router;
