import express from 'express';
import { pool } from '../db.js';
import { firebaseAuth } from '../middleware/firebaseAuth.js';
import { ensureUser } from '../middleware/ensureUser.js';
import { enforceReadOnlyRole } from '../middleware/readOnlyRole.js';
import { requireAnyRole } from '../middleware/requireAnyRole.js';
import { VALID_ROLES } from '../constants/roles.js';

const router = express.Router();
router.use(firebaseAuth, ensureUser, enforceReadOnlyRole);

/**
 * GET /api/master/terminales
 * Lista todos los terminales disponibles
 */
router.get('/terminales', requireAnyRole(...VALID_ROLES), async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre FROM pmp.terminales ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching terminales:', error);
        res.status(500).json({ error: 'Error al obtener terminales' });
    }
});

/**
 * GET /api/master/psts
 * Lista todos los operadores PST
 */
router.get('/psts', requireAnyRole(...VALID_ROLES), async (req, res) => {
    try {
        const result = await pool.query('SELECT codigo, nombre FROM pmp.pst ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching psts:', error);
        res.status(500).json({ error: 'Error al obtener psts' });
    }
});

export default router;
