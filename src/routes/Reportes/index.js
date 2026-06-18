import express from 'express';
import { obtenerReporteHibrido } from '../../controllers/reporteControllers/index.js';
import { verifyToken } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// 🔒 Endpoint unificado y protegido para reportes manuales, IA y exportaciones (Excel/PDF)
router.post('/generar', verifyToken, obtenerReporteHibrido);

export default router;